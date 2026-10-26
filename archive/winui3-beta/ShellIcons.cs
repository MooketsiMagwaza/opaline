using System.Runtime.InteropServices;

namespace GlassLauncher;

// Fetches the same icon Explorer draws (including for .lnk shortcuts to desktop and Store apps)
// through IShellItemImageFactory, as premultiplied BGRA pixels.
internal static class ShellIcons
{
    private const uint SIIGBF_ICONONLY = 0x04;

    [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItemImageFactory
    {
        [PreserveSig]
        int GetImage(SIZE size, uint flags, out IntPtr hbitmap);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SIZE
    {
        public int cx, cy;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BITMAP
    {
        public int bmType, bmWidth, bmHeight, bmWidthBytes;
        public ushort bmPlanes, bmBitsPixel;
        public IntPtr bmBits;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BITMAPINFOHEADER
    {
        public uint biSize;
        public int biWidth, biHeight;
        public ushort biPlanes, biBitCount;
        public uint biCompression, biSizeImage;
        public int biXPelsPerMeter, biYPelsPerMeter;
        public uint biClrUsed, biClrImportant;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    private static extern void SHCreateItemFromParsingName(
        string path, IntPtr bindContext, [In] ref Guid riid, out IShellItemImageFactory factory);

    [DllImport("gdi32.dll")]
    private static extern int GetObject(IntPtr handle, int count, out BITMAP bitmap);

    [DllImport("gdi32.dll")]
    private static extern int GetDIBits(
        IntPtr hdc, IntPtr bitmap, uint startLine, uint lineCount, byte[] bits, ref BITMAPINFOHEADER info, uint usage);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr handle);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);

    public static (byte[] Pixels, int Width, int Height)? GetIconPixels(string path, int size)
    {
        var iid = typeof(IShellItemImageFactory).GUID;
        SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out var factory);
        IntPtr hbitmap = IntPtr.Zero;

        try
        {
            if (factory.GetImage(new SIZE { cx = size, cy = size }, SIIGBF_ICONONLY, out hbitmap) != 0
                || hbitmap == IntPtr.Zero)
                return null;

            GetObject(hbitmap, Marshal.SizeOf<BITMAP>(), out var bitmap);
            int width = bitmap.bmWidth, height = bitmap.bmHeight;

            // Negative height asks for a top-down DIB, which is the order WriteableBitmap expects.
            var info = new BITMAPINFOHEADER
            {
                biSize = (uint)Marshal.SizeOf<BITMAPINFOHEADER>(),
                biWidth = width,
                biHeight = -height,
                biPlanes = 1,
                biBitCount = 32,
            };

            var pixels = new byte[width * height * 4];
            IntPtr hdc = GetDC(IntPtr.Zero);
            try
            {
                if (GetDIBits(hdc, hbitmap, 0, (uint)height, pixels, ref info, 0) == 0)
                    return null;
            }
            finally
            {
                ReleaseDC(IntPtr.Zero, hdc);
            }

            // Icons without an alpha channel come back fully transparent; make them opaque instead.
            bool hasAlpha = false;
            for (int i = 3; i < pixels.Length; i += 4)
            {
                if (pixels[i] != 0)
                {
                    hasAlpha = true;
                    break;
                }
            }

            if (!hasAlpha)
            {
                for (int i = 3; i < pixels.Length; i += 4)
                    pixels[i] = 255;
            }

            return (pixels, width, height);
        }
        finally
        {
            if (hbitmap != IntPtr.Zero)
                DeleteObject(hbitmap);
            Marshal.ReleaseComObject(factory);
        }
    }
}
