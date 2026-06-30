using System;

namespace ShepherdCare.Api.Services
{
    public interface IEncryptionService
    {
        // returns base64 ciphertext and base64 iv
        (string CipherText, string Iv) Encrypt(string plainText);
        string Decrypt(string cipherText, string iv);
    }
}
