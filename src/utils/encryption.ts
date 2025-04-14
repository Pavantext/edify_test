import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

// Ensure KEY and IV are consistent
const KEY = Buffer.from(process.env.NEXT_PUBLIC_ENCRYPTION_KEY as string, 'hex');
const IV = Buffer.from(process.env.NEXT_PUBLIC_ENCRYPTION_IV as string, 'hex');

export const encrypt = (text: string): string => {
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

export const decrypt = (encryptedText: string): string => {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};