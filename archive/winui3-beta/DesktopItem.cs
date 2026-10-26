using System.ComponentModel;
using Microsoft.UI.Xaml.Media;

namespace GlassLauncher;

public sealed class DesktopItem : INotifyPropertyChanged
{
    // Plain get/set properties: the XAML compiler's generated type info can't use required/init members.
    public string Name { get; set; } = string.Empty;
    public string FullPath { get; set; } = string.Empty;
    public bool IsFolder { get; set; }

    private ImageSource? _icon;
    public ImageSource? Icon
    {
        get => _icon;
        set
        {
            _icon = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Icon)));
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
}
