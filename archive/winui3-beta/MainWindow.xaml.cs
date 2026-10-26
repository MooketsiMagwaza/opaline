using System.Collections.ObjectModel;
using System.Diagnostics;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media.Animation;
using Windows.Graphics;
using Windows.System;
using WinRT.Interop;

namespace GlassLauncher;

public sealed partial class MainWindow : Window
{
    private const int HotkeyId = 0x4C47;
    private const int WidthDips = 920;
    private const int HeightDips = 620;
    private const double EntranceScale = 0.965;

    private readonly IntPtr _hwnd;
    private readonly List<DesktopItem> _all = new();
    private readonly Native.SubclassProc _subclass; // field so the delegate isn't collected
    private readonly bool _hotkeyRegistered;
    private readonly bool _pinned;
    private Storyboard? _entrance;

    public ObservableCollection<DesktopItem> Items { get; } = new();

    public MainWindow(bool startHidden, bool pinned)
    {
        _pinned = pinned;
        InitializeComponent();
        Title = "Glass Launcher";
        SystemBackdrop = new GlassBackdrop();
        _hwnd = WindowNative.GetWindowHandle(this);
        ConfigureChrome();

        _subclass = WndProc;
        Native.SetWindowSubclass(_hwnd, _subclass, (UIntPtr)1, UIntPtr.Zero);
        _hotkeyRegistered = Native.RegisterHotKey(
            _hwnd, HotkeyId, Native.MOD_CONTROL | Native.MOD_ALT | Native.MOD_NOREPEAT, Native.VK_SPACE);

        Refresh();

        Activated += OnActivated;
        Closed += (_, _) => Native.UnregisterHotKey(_hwnd, HotkeyId);

        if (!startHidden)
            ShowLauncher();
    }

    private void ConfigureChrome()
    {
        var presenter = (OverlappedPresenter)AppWindow.Presenter;
        presenter.SetBorderAndTitleBar(false, false);
        presenter.IsResizable = false;
        presenter.IsMaximizable = false;
        presenter.IsMinimizable = false;
        presenter.IsAlwaysOnTop = true;
        AppWindow.IsShownInSwitchers = false;
        Native.RoundCorners(_hwnd);
    }

    private IntPtr WndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, UIntPtr id, UIntPtr data)
    {
        if (msg == Native.WM_HOTKEY && wParam.ToInt32() == HotkeyId)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                if (AppWindow.IsVisible)
                    HideLauncher();
                else
                    ShowLauncher();
            });
            return IntPtr.Zero;
        }

        return Native.DefSubclassProc(hWnd, msg, wParam, lParam);
    }

    private void ShowLauncher()
    {
        // Open on whichever monitor the cursor is on, centered in its work area.
        Native.GetCursorPos(out var cursor);
        var work = DisplayArea.GetFromPoint(new PointInt32(cursor.X, cursor.Y), DisplayAreaFallback.Nearest).WorkArea;

        // Move first so the DPI we read belongs to the target monitor.
        AppWindow.Move(new PointInt32(work.X + 20, work.Y + 20));
        double scale = Native.GetDpiForWindow(_hwnd) / 96.0;
        int width = Math.Min((int)(WidthDips * scale), work.Width - 40);
        int height = Math.Min((int)(HeightDips * scale), work.Height - 40);
        AppWindow.MoveAndResize(new RectInt32(
            work.X + (work.Width - width) / 2,
            work.Y + (work.Height - height) / 2,
            width, height));

        SearchBox.Text = string.Empty;
        Refresh();

        PrepareEntrance();
        AppWindow.Show();
        Activate();
        Native.SetForegroundWindow(_hwnd);
        SearchBox.Focus(FocusState.Programmatic);
        PlayEntrance();
    }

    private void HideLauncher() => AppWindow.Hide();

    // Content starts slightly small and transparent, then eases to full size while the glass pane stays put.
    private void PrepareEntrance()
    {
        _entrance?.Stop();
        Root.Opacity = 0;
        RootScale.ScaleX = EntranceScale;
        RootScale.ScaleY = EntranceScale;
    }

    private void PlayEntrance()
    {
        _entrance = new Storyboard();
        AddEntranceAnimation(Root, "Opacity", 0, 1, 180);
        AddEntranceAnimation(RootScale, "ScaleX", EntranceScale, 1, 240);
        AddEntranceAnimation(RootScale, "ScaleY", EntranceScale, 1, 240);
        _entrance.Begin();
    }

    private void AddEntranceAnimation(DependencyObject target, string property, double from, double to, int milliseconds)
    {
        var animation = new DoubleAnimation
        {
            From = from,
            To = to,
            Duration = TimeSpan.FromMilliseconds(milliseconds),
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
        };
        Storyboard.SetTarget(animation, target);
        Storyboard.SetTargetProperty(animation, property);
        _entrance!.Children.Add(animation);
    }

    private void OnActivated(object sender, WindowActivatedEventArgs e)
    {
        if (!_pinned && e.WindowActivationState == WindowActivationState.Deactivated && AppWindow.IsVisible)
            HideLauncher();
    }

    // Re-reads the desktop folders, keeping already-loaded icons for items that are still there.
    private void Refresh()
    {
        var known = _all.ToDictionary(i => i.FullPath, StringComparer.OrdinalIgnoreCase);
        var added = new List<DesktopItem>();

        _all.Clear();
        foreach (var item in DesktopScanner.Scan())
        {
            if (known.TryGetValue(item.FullPath, out var existing))
            {
                _all.Add(existing);
            }
            else
            {
                _all.Add(item);
                added.Add(item);
            }
        }

        _ = LoadIconsAsync(added);
        ApplyFilter(SearchBox.Text);
    }

    private static async Task LoadIconsAsync(List<DesktopItem> items)
    {
        await Task.WhenAll(items.Select(async item => item.Icon = await DesktopScanner.LoadIconAsync(item)));
    }

    private void ApplyFilter(string query)
    {
        query = query.Trim();

        IEnumerable<DesktopItem> matches = _all;
        if (query.Length > 0)
        {
            matches = _all
                .Where(i => i.Name.Contains(query, StringComparison.CurrentCultureIgnoreCase))
                .OrderBy(i => i.Name.StartsWith(query, StringComparison.CurrentCultureIgnoreCase) ? 0 : 1);
        }

        Items.Clear();
        foreach (var item in matches)
            Items.Add(item);

        string hint = _hotkeyRegistered
            ? "Ctrl+Alt+Space to toggle  ·  Esc to hide"
            : "Ctrl+Alt+Space is already used by another app";
        StatusText.Text = Items.Count == _all.Count
            ? $"{_all.Count} items  ·  {hint}"
            : $"{Items.Count} of {_all.Count} items  ·  {hint}";
    }

    private void Launch(DesktopItem item)
    {
        HideLauncher();
        try
        {
            Process.Start(new ProcessStartInfo(item.FullPath) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Couldn't open {item.FullPath}: {ex.Message}");
        }
    }

    private void SearchBox_TextChanged(object sender, TextChangedEventArgs e) => ApplyFilter(SearchBox.Text);

    private void SearchBox_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == VirtualKey.Enter && Items.FirstOrDefault() is { } first)
        {
            Launch(first);
            e.Handled = true;
        }
        else if (e.Key == VirtualKey.Down)
        {
            ItemsGrid.Focus(FocusState.Keyboard);
            e.Handled = true;
        }
    }

    private void ItemsGrid_ItemClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is DesktopItem item)
            Launch(item);
    }

    private void Hide_Invoked(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        HideLauncher();
        args.Handled = true;
    }

    private void Quit_Invoked(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        Application.Current.Exit();
        args.Handled = true;
    }

    private void Quit_Click(object sender, RoutedEventArgs e) => Application.Current.Exit();
}
