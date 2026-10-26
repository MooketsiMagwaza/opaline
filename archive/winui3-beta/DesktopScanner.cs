using System.Runtime.InteropServices.WindowsRuntime;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;

namespace GlassLauncher;

public static class DesktopScanner
{
    // Both the user's desktop and the all-users desktop feed the icons Explorer shows.
    // GetFolderPath follows OneDrive folder redirection, so no hard-coded paths.
    public static List<DesktopItem> Scan()
    {
        var roots = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory),
        };

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var items = new List<DesktopItem>();

        foreach (var root in roots.Where(r => !string.IsNullOrEmpty(r) && Directory.Exists(r))
                                  .Distinct(StringComparer.OrdinalIgnoreCase))
        {
            foreach (var entry in new DirectoryInfo(root).EnumerateFileSystemInfos())
            {
                if ((entry.Attributes & (System.IO.FileAttributes.Hidden | System.IO.FileAttributes.System)) != 0)
                    continue;

                bool isFolder = entry is DirectoryInfo;
                bool isShortcut = !isFolder && entry.Extension is ".lnk" or ".url";
                string name = isShortcut ? Path.GetFileNameWithoutExtension(entry.Name) : entry.Name;

                if (!seen.Add(name))
                    continue;

                items.Add(new DesktopItem { Name = name, FullPath = entry.FullName, IsFolder = isFolder });
            }
        }

        return items
            .OrderByDescending(i => i.IsFolder)
            .ThenBy(i => i.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    // Asks the shell for the same icon Explorer would draw (works for .lnk, .exe, folders, documents).
    // Pixels are fetched off the UI thread; the WriteableBitmap must be created back on it.
    public static async Task<ImageSource?> LoadIconAsync(DesktopItem item)
    {
        try
        {
            var icon = await Task.Run(() => ShellIcons.GetIconPixels(item.FullPath, 128));
            if (icon is not { } data)
                return null;

            var bitmap = new WriteableBitmap(data.Width, data.Height);
            using (var stream = bitmap.PixelBuffer.AsStream())
                stream.Write(data.Pixels, 0, data.Pixels.Length);
            bitmap.Invalidate();
            return bitmap;
        }
        catch
        {
            return null;
        }
    }
}
