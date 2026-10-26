using Microsoft.UI.Composition;
using Microsoft.UI.Composition.SystemBackdrops;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Windows.UI;

namespace GlassLauncher;

// Desktop acrylic with a tunable tint. The configuration is pinned to "input active" so the blur
// doesn't drop to a flat fallback colour whenever the window loses focus.
public sealed class GlassBackdrop : SystemBackdrop
{
    private DesktopAcrylicController? _controller;
    private SystemBackdropConfiguration? _configuration;

    private Color _tintColor = Color.FromArgb(255, 20, 24, 40);
    private float _tintOpacity = 0.08f;
    private float _luminosityOpacity = 0.15f;

    public Color TintColor
    {
        get => _tintColor;
        set { _tintColor = value; Apply(); }
    }

    public float TintOpacity
    {
        get => _tintOpacity;
        set { _tintOpacity = value; Apply(); }
    }

    public float LuminosityOpacity
    {
        get => _luminosityOpacity;
        set { _luminosityOpacity = value; Apply(); }
    }

    private void Apply()
    {
        if (_controller is null)
            return;

        _controller.TintColor = _tintColor;
        _controller.TintOpacity = _tintOpacity;
        _controller.LuminosityOpacity = _luminosityOpacity;
        _controller.FallbackColor = _tintColor;
    }

    protected override void OnTargetConnected(ICompositionSupportsSystemBackdrop connectedTarget, XamlRoot xamlRoot)
    {
        base.OnTargetConnected(connectedTarget, xamlRoot);

        _configuration = new SystemBackdropConfiguration
        {
            IsInputActive = true,
            Theme = SystemBackdropTheme.Dark,
        };

        _controller = new DesktopAcrylicController();
        Apply();
        _controller.AddSystemBackdropTarget(connectedTarget);
        _controller.SetSystemBackdropConfiguration(_configuration);
    }

    protected override void OnTargetDisconnected(ICompositionSupportsSystemBackdrop disconnectedTarget)
    {
        base.OnTargetDisconnected(disconnectedTarget);

        _controller?.RemoveSystemBackdropTarget(disconnectedTarget);
        _controller?.Dispose();
        _controller = null;
        _configuration = null;
    }
}
