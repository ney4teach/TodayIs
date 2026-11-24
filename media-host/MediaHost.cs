using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using Windows.Media.Control;
using Windows.Storage.Streams;
using System.Drawing;
using System.Drawing.Imaging;

class MediaHost
{
    static GlobalSystemMediaTransportControlsSessionManager manager;
    static string displayed, stage;
    static int generation;
    static string coverKey, cover, tint;
    static readonly Dictionary<GlobalSystemMediaTransportControlsSession,string> handles =
        new Dictionary<GlobalSystemMediaTransportControlsSession,string>();

    static string AppName(string id)
    {
        foreach (string name in new[] {"Spotify", "YandexMusic", "Chrome", "Firefox", "msedge", "Opera", "VLC"})
            if (id.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0)
                return name == "msedge" ? "Edge" : name == "YandexMusic" ? "Яндекс Музыка" : name;
        var parts = id.Split('!')[0].Split('_')[0].Split('.');
        return parts[parts.Length - 1];
    }

    static string GetTint(Bitmap coverImage)
    {
        var bins = new Dictionary<int,int[]>();
        for (int x = 3; x < coverImage.Width; x += 6)
            for (int y = 3; y < coverImage.Height; y += 6) {
                Color c = coverImage.GetPixel(x,y);
                if (c.GetBrightness() < .12 || c.GetBrightness() > .9) continue;
                int key = (int)c.GetHue() / 30 + (c.GetSaturation() < .20 ? 12 : 0);
                int[] bin;
                if (!bins.TryGetValue(key,out bin)) bins[key] = bin = new int[5];
                bin[0] += c.GetSaturation() > .25 ? 3 : 1;
                bin[1]++; bin[2] += c.R; bin[3] += c.G; bin[4] += c.B;
            }
        var best = bins.Values.OrderByDescending(b => b[0]).FirstOrDefault();
        return best == null ? null : String.Format("#{0:X2}{1:X2}{2:X2}",best[2]/best[1],best[3]/best[1],best[4]/best[1]);
    }

    static T Wait<T>(Windows.Foundation.IAsyncOperation<T> op)
    {
        try {
            var limit = System.Diagnostics.Stopwatch.StartNew();
            while (op.Status == Windows.Foundation.AsyncStatus.Started) {
                if (limit.ElapsedMilliseconds > 5000) { op.Cancel(); throw new TimeoutException(); }
                System.Threading.Thread.Sleep(12);
            }
            return op.GetResults();
        } finally { op.Close(); }
    }

    static string Artwork(GlobalSystemMediaTransportControlsSessionMediaProperties item)
    {
        tint = null;
        if (item == null || item.Thumbnail == null) return null;
        try {
            using (var stream = Wait(item.Thumbnail.OpenReadAsync()))
            using (var reader = new DataReader(stream.GetInputStreamAt(0))) {
                if (stream.Size > 16000000 || stream.Size == 0) return null;
                uint size = (uint)stream.Size;
                if (Wait(reader.LoadAsync(size)) != size) return null;
                var buffer = new byte[size];
                reader.ReadBytes(buffer);
                using (var input = new MemoryStream(buffer))
                using (var image = Image.FromStream(input))
                using (var small = new Bitmap(image, new Size(144,144)))
                using (var output = new MemoryStream()) {
                    tint = GetTint(small);
                    small.Save(output, ImageFormat.Jpeg);
                    return "data:image/jpeg;base64," + Convert.ToBase64String(output.ToArray());
                }
            }
        } catch { return null; }
    }

    static bool IsPlaying(GlobalSystemMediaTransportControlsSession session)
    {
        try { return session != null && session.GetPlaybackInfo().PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing; }
        catch (System.Runtime.InteropServices.COMException) { return false; }
    }

    static GlobalSystemMediaTransportControlsSession YandexSession()
    {
        var sessions = manager.GetSessions();
        for (int i = 0; i < sessions.Count; i++) {
            var session = sessions[i];
            try {
                string id = (session.SourceAppUserModelId ?? "").ToLowerInvariant();
                if ((id.Contains("yandex") && id.Contains("music")) ||
                    (id.Contains("яндекс") && id.Contains("музык"))) return session;
            } catch (System.Runtime.InteropServices.COMException) { }
        }
        return null;
    }

    static bool OpenYandexMusic()
    {
        string target = null;
        foreach (var root in new[] { Environment.SpecialFolder.LocalApplicationData, Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.ProgramFilesX86 }) {
            string folder = Environment.GetFolderPath(root);
            if (String.IsNullOrEmpty(folder)) continue;
            if (root == Environment.SpecialFolder.LocalApplicationData) folder = Path.Combine(folder,"Programs");
            foreach (string file in new[] { "Яндекс Музыка.exe", "Yandex Music.exe", "YandexMusic.exe" }) {
                string exe = Path.Combine(folder,"YandexMusic",file);
                if (File.Exists(exe)) { target = exe; break; }
            }
            if (target != null) break;
        }
        if (target == null) {
            using (var protocol = Microsoft.Win32.Registry.ClassesRoot.OpenSubKey("yandexmusic")) {
                if (protocol == null || protocol.GetValue("URL Protocol") == null) return false;
            }
            target = "yandexmusic://";
        }
        // Explorer launches the desktop app outside Chrome's native-host process tree.
        var explorer = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"explorer.exe");
        using (System.Diagnostics.Process.Start(explorer, "\"" + target + "\"")) { }
        return true;
    }

    static object LaunchYandex()
    {
        stage = "Запуск Яндекс Музыки";
        var session = YandexSession();
        if (session == null && !OpenYandexMusic())
            return new { message = "Установленная Яндекс Музыка не найдена." };
        var elapsed = System.Diagnostics.Stopwatch.StartNew();
        while (elapsed.ElapsedMilliseconds < 15000) {
            if (session != null) {
                try {
                    var info = session.GetPlaybackInfo();
                    if (IsPlaying(session) || (info != null && info.Controls != null &&
                        info.Controls.IsPlayEnabled && Wait(session.TryPlayAsync())))
                        return new { app = session.SourceAppUserModelId, message = "Яндекс Музыка включена" };
                } catch (System.Runtime.InteropServices.COMException) { }
            }
            System.Threading.Thread.Sleep(500);
            session = YandexSession();
        }
        return new { message = "Выберите трек в Яндекс Музыке, чтобы начать воспроизведение." };
    }

    static object Respond(Dictionary<string,object> request)
    {
        stage = "Подключение к медиаслужбе";
        if (manager == null) manager = Wait(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
        if ((string)request["action"] == "launchYandex") return LaunchYandex();
        stage = "Чтение списка плееров";
        var current = manager.GetCurrentSession();
        var list = manager.GetSessions();
        var sessions = new List<GlobalSystemMediaTransportControlsSession>();
        var apps = new Dictionary<GlobalSystemMediaTransportControlsSession,string>();
        for (int i = 0; i < list.Count; i++) {
            var candidate = list[i];
            try {
                string app = candidate.SourceAppUserModelId;
                if (String.IsNullOrEmpty(app)) continue;
                apps[candidate] = app;
                sessions.Add(candidate);
            } catch (System.Runtime.InteropServices.COMException) { continue; }
        }
        foreach (var stale in handles.Keys.Where(s => !apps.ContainsKey(s)).ToArray()) handles.Remove(stale);
        foreach (var candidate in sessions)
            if (!handles.ContainsKey(candidate)) {
                string appId = apps[candidate];
                handles[candidate] = apps.Values.Count(app => app == appId) == 1
                    ? "app:" + appId : Guid.NewGuid().ToString("N");
            }
        var sources = sessions.Select(s => {
            string app = apps[s];
            string label = AppName(app);
            if (apps.Values.Count(value => value == app) > 1) {
                try { label += " · " + Wait(s.TryGetMediaPropertiesAsync()).Title; } catch { }
            }
            return new { app, label, id = handles[s] };
        }).ToArray();
        string pin = request.ContainsKey("pin") ? request["pin"] as string : null;
        string handle = request.ContainsKey("handle") ? request["handle"] as string : null;
        var session = sessions.FirstOrDefault(s => s == current);
        if (session == null && current != null) {
            try {
                string currentApp = current.SourceAppUserModelId;
                session = sessions.FirstOrDefault(s => apps[s] == currentApp);
            } catch (System.Runtime.InteropServices.COMException) { }
        }
        if (!String.IsNullOrEmpty(pin)) {
            var matches = sessions.Where(s => apps[s] == pin).ToArray();
            session = matches.FirstOrDefault(s => handles[s] == handle);
            if (session == null && matches.Length == 1 && String.IsNullOrEmpty(handle)) session = matches[0];
        } else if (!IsPlaying(session))
            session = sessions.FirstOrDefault(IsPlaying) ?? session ?? sessions.FirstOrDefault();
        string sourceId = session == null ? null : handles[session];
        if (displayed != sourceId) { displayed = sourceId; generation++; coverKey = null; }
        if (session == null) return new { status = "idle", sources };
        string action = (string)request["action"];
        stage = "Чтение состояния плеера";
        var info = session.GetPlaybackInfo();
        var controls = info == null ? null : info.Controls;
        GlobalSystemMediaTransportControlsSessionMediaProperties item = null;
        try { item = Wait(session.TryGetMediaPropertiesAsync()); } catch (Exception) { }
        string title = item == null ? AppName(apps[session]) : item.Title;
        string artist = item == null ? "" : item.Artist;
        string trackKey = title + "\0" + artist + "\0" + (item == null ? "" : item.AlbumTitle);
        GlobalSystemMediaTransportControlsSessionTimelineProperties timeline = null;
        try { timeline = session.GetTimelineProperties(); } catch (System.Runtime.InteropServices.COMException) { }
        double start = timeline == null ? 0 : timeline.StartTime.TotalSeconds;
        double end = timeline == null ? 0 : timeline.EndTime.TotalSeconds;
        double lower = start, upper = end;
        if (timeline != null && timeline.MaxSeekTime > timeline.MinSeekTime) {
            lower = Math.Max(start, timeline.MinSeekTime.TotalSeconds);
            upper = Math.Min(end, timeline.MaxSeekTime.TotalSeconds);
        }
        bool seek = controls != null && controls.IsPlaybackPositionEnabled && upper > lower;
        bool accepted = true;
        if (action != "read" && Convert.ToInt32(request["generation"]) == generation) {
            switch (action) {
                case "seek":
                    double seconds = Convert.ToDouble(request["seconds"]);
                    accepted = seek && (string)request["trackKey"] == trackKey && seconds >= lower && seconds <= upper
                        && Wait(session.TryChangePlaybackPositionAsync(TimeSpan.FromSeconds(seconds).Ticks));
                    break;
                case "play": accepted = controls != null && controls.IsPlayEnabled && Wait(session.TryPlayAsync()); break;
                case "pause": accepted = controls != null && controls.IsPauseEnabled && Wait(session.TryPauseAsync()); break;
                case "next": accepted = controls != null && controls.IsNextEnabled && Wait(session.TrySkipNextAsync()); break;
                case "previous": accepted = controls != null && controls.IsPreviousEnabled && Wait(session.TrySkipPreviousAsync()); break;
            }
        }
        if (action != "read") info = session.GetPlaybackInfo();
        controls = info == null ? null : info.Controls;
        string key = title + "\0" + artist + "\0" + (item == null ? "" : item.AlbumTitle) + (item != null && item.Thumbnail != null);
        if (key != coverKey) { cover = Artwork(item); coverKey = key; }
        bool playing = info != null && info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
        double position = timeline == null ? start : timeline.Position.TotalSeconds;
        if (timeline != null && playing && timeline.LastUpdatedTime.Year > 1970)
            position += Math.Max(0, (DateTimeOffset.UtcNow - timeline.LastUpdatedTime).TotalSeconds) * (info.PlaybackRate ?? 1.0);
        position = Math.Max(start, Math.Min(end, position));
        return new { status = "active", generation, sources, sourceId, tint, trackKey, lower, upper, start, end, seek, position, title, artist, cover,
            playing = info != null && info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
            play = controls != null && controls.IsPlayEnabled, pause = controls != null && controls.IsPauseEnabled,
            previous = controls != null && controls.IsPreviousEnabled, next = controls != null && controls.IsNextEnabled, accepted };
    }

    [MTAThread]
    static void Main()
    {
        var json = new JavaScriptSerializer();
        using (var input = new BinaryReader(Console.OpenStandardInput()))
        using (var output = new BinaryWriter(Console.OpenStandardOutput())) {
            while (true) {
                try {
                    int size = input.ReadInt32();
                    if (size <= 0 || size > 4096) return;
                    var bytes = input.ReadBytes(size);
                    if (bytes.Length != size) return;
                    object response;
                    try { response = Respond(json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(bytes))); }
                    catch (Exception ex) {
                        manager = null;
                        response = new { status = "error", detail = stage + " · 0x" + ex.HResult.ToString("X8") + " · " + ex.Message.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() };
                    }
                    bytes = Encoding.UTF8.GetBytes(json.Serialize(response));
                    output.Write(bytes.Length);
                    output.Write(bytes);
                    output.Flush();
                } catch (IOException) { return; }
            }
        }
    }
}

