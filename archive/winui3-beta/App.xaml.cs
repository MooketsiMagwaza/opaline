using Microsoft.UI.Xaml;

namespace GlassLauncher;

public partial class App : Application
{
    // Held for the life of the process so a second launch can tell we're already running.
    private static Mutex? _singleInstance;
    private MainWindow? _window;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _singleInstance = new Mutex(true, "GlassLauncher.SingleInstance", out bool createdNew);
        if (!createdNew)
        {
            Environment.Exit(0);
            return;
        }

        var commandLine = Environment.GetCommandLineArgs();
        bool startHidden = commandLine.Contains("--hidden");
        bool pinned = commandLine.Contains("--pin"); // keep the window open when it loses focus (for tweaking the look)
        _window = new MainWindow(startHidden, pinned);
    }
}
