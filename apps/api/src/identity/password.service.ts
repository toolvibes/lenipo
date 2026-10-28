import { Injectable } from '@nestjs/common';
import { hash, type Options, verify } from '@node-rs/argon2';

/** OWASP recommendation for Argon2id: 19 MiB memory, 2 iterations, 1 lane. */
const OPTIONS: Options = {
  algorithm: 2 as Options['algorithm'], // Algorithm.Argon2id (a const enum, not importable here)
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  /** Hash verified when the account does not exist, so response times do not reveal emails. */
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(passwordHash: string | null | undefined, password: string): Promise<boolean> {
    if (!passwordHash) {
      this.dummyHash ??= hash('tasklore-dummy-password', OPTIONS);
      await verify(await this.dummyHash, password);
      return false;
    }
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
