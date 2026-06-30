using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace ShepherdCare.Api.Services
{
    public class AesEncryptionService : IEncryptionService
    {
        private readonly byte[] _key;

        public AesEncryptionService()
        {
            var keyRaw = Environment.GetEnvironmentVariable("ENCRYPTION_KEY");
            if (string.IsNullOrEmpty(keyRaw))
                throw new InvalidOperationException("ENCRYPTION_KEY must be set in environment");

            // Accept base64
            try
            {
                _key = Convert.FromBase64String(keyRaw);
            }
            catch
            {
                // fallback to utf8 bytes
                _key = Encoding.UTF8.GetBytes(keyRaw);
            }

            if (!(_key.Length == 16 || _key.Length == 24 || _key.Length == 32))
                throw new InvalidOperationException("ENCRYPTION_KEY must be 16/24/32 bytes (raw) or base64 of that length");
        }

        public (string CipherText, string Iv) Encrypt(string plainText)
        {
            using var aes = Aes.Create();
            aes.Key = _key;
            aes.GenerateIV();
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            using var encryptor = aes.CreateEncryptor();
            var plainBytes = Encoding.UTF8.GetBytes(plainText);
            var cipherBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

            return (Convert.ToBase64String(cipherBytes), Convert.ToBase64String(aes.IV));
        }

        public string Decrypt(string cipherText, string iv)
        {
            using var aes = Aes.Create();
            aes.Key = _key;
            aes.IV = Convert.FromBase64String(iv);
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            using var decryptor = aes.CreateDecryptor();
            var cipherBytes = Convert.FromBase64String(cipherText);
            var plainBytes = decryptor.TransformFinalBlock(cipherBytes, 0, cipherBytes.Length);
            return Encoding.UTF8.GetString(plainBytes);
        }
    }
}
