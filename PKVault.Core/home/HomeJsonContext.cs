using System.Text.Json.Serialization;

namespace PKVault.Core;

[JsonSerializable(typeof(Dictionary<string, string>))]
internal partial class HomeJsonContext : JsonSerializerContext { }
