import { Notice, TFolder } from 'obsidian';
import type { App } from 'obsidian';
import type { DailyNewsSettings } from './types';
import { FileUtils } from './utils';
import { localDate, newsNoteDate } from './runtime-utils';

/** Moves notes saved directly in the archive folder into monthly (YYYY-MM) subfolders. */
export async function reorganizeExistingNotes(app: App, settings: DailyNewsSettings): Promise<void> {
    try {
        const archiveFolder = FileUtils.normalizePath(settings.archiveFolder);

        // Check if archive folder exists
        if (!(await app.vault.adapter.exists(archiveFolder))) {
            new Notice('Archive folder not found. Nothing to reorganize.', 3000);
            return;
        }

        // Get all files in the archive folder (non-recursive)
        const files = app.vault.getFiles().filter(file => {
            const normalizedPath = FileUtils.normalizePath(file.path);
            const parentFolder = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));

            // Only include files directly in archive folder (not in subfolders)
            return parentFolder === archiveFolder &&
                   file.extension === 'md' &&
                   file.name.startsWith('Daily News - ');
        });

        if (files.length === 0) {
            new Notice('No daily news files found to reorganize.', 3000);
            return;
        }

        new Notice(`Found ${files.length} file(s) to reorganize...`, 3000);
        let moved = 0;
        let skipped = 0;
        let errors = 0;

        for (const file of files) {
            try {
                // Extract date from filename (format: "Daily News - YYYY-MM-DD.md")
                const dateMatch = file.name.match(/Daily News - (\d{4}-\d{2}-\d{2})\.md/);

                if (!dateMatch) {
                    console.warn(`Skipping file with unexpected format: ${file.name}`);
                    skipped++;
                    continue;
                }

                const dateStr = dateMatch[1];
                const yearMonth = dateStr.substring(0, 7); // Extract YYYY-MM
                const monthlyFolder = `${archiveFolder}/${yearMonth}`;
                const newPath = `${monthlyFolder}/${file.name}`;

                // Skip if file is already in the correct location
                if (file.path === newPath) {
                    skipped++;
                    continue;
                }

                // Create monthly folder if it doesn't exist
                if (!(await app.vault.adapter.exists(monthlyFolder))) {
                    await app.vault.createFolder(monthlyFolder);
                }

                // Check if a file with the same name already exists in the target folder
                if (await app.vault.adapter.exists(newPath)) {
                    console.warn(`File already exists at target location: ${newPath}`);
                    skipped++;
                    continue;
                }

                // Move the file
                await app.fileManager.renameFile(file, newPath);
                moved++;

            } catch (fileError) {
                console.error(`Error moving file ${file.name}:`, fileError);
                errors++;
            }
        }

        // Show summary
        const summary = [];
        if (moved > 0) summary.push(`${moved} moved`);
        if (skipped > 0) summary.push(`${skipped} skipped`);
        if (errors > 0) summary.push(`${errors} errors`);

        new Notice(`Reorganization complete: ${summary.join(', ')}`, 5000);

    } catch (error) {
        console.error('Error during reorganization:', error);
        new Notice('Failed to reorganize notes. Check console for details.', 5000);
    }
}

export async function deleteOldNewsNotes(app: App, settings: DailyNewsSettings): Promise<void> {
    if (settings.autoDeleteRetention === 'never') {
        return;
    }

    const retentionDays: Record<string, number> = {
        '1d': 1, '3d': 3, '1w': 7, '2w': 14,
        '1m': 30, '3m': 90, '6m': 180, '1y': 365
    };

    const days = retentionDays[settings.autoDeleteRetention];
    if (!days) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = localDate(cutoff); // File names use local calendar dates.

    const archiveFolder = FileUtils.normalizePath(settings.archiveFolder);
    const files = app.vault.getFiles().filter(file => {
        const normalizedPath = FileUtils.normalizePath(file.path);
        return normalizedPath.startsWith(archiveFolder + '/') &&
               file.extension === 'md' &&
               file.name.startsWith('Daily News - ');
    });

    let deletedFiles = 0;
    const affectedFolders = new Set<string>();
    for (const file of files) {
        const noteDate = newsNoteDate(file.name); // Includes "Retry" notes.
        if (!noteDate) continue;
        if (noteDate < cutoffStr) {
            try {
                affectedFolders.add(FileUtils.normalizePath(file.parent?.path ?? ''));
                await app.fileManager.trashFile(file);
                deletedFiles++;
            } catch {
                console.error(`Failed to delete ${file.path}`);
            }
        }
    }

    // Remove any monthly folders that are now empty
    let deletedFolders = 0;
    for (const folderPath of affectedFolders) {
        if (!folderPath || folderPath === archiveFolder) continue;
        const folder = app.vault.getAbstractFileByPath(folderPath);
        if (folder instanceof TFolder && folder.children.length === 0) {
            try {
                await app.fileManager.trashFile(folder);
                deletedFolders++;
            } catch {
                console.error(`Failed to delete empty folder ${folderPath}`);
            }
        }
    }

    if (deletedFiles > 0 || deletedFolders > 0) {
        new Notice(`Deleted ${deletedFiles} old news note${deletedFiles > 1 ? 's' : ''} and ${deletedFolders} empty folder${deletedFolders > 1 ? 's' : ''}.`, 4000);
    }
}
