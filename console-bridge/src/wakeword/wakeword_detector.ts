export class WakewordDetector {
  private readonly normalizedPhrase: string;
  private readonly phraseTokens: string[];

  constructor(private readonly phrase: string) {
    this.normalizedPhrase = WakewordDetector.normalize(phrase);
    if (!this.normalizedPhrase) {
      throw new Error("Wake phrase cannot be empty");
    }
    this.phraseTokens = WakewordDetector.tokenize(this.normalizedPhrase);
  }

  public matches(text: string): boolean {
    const normalizedText = WakewordDetector.normalize(text);
    const textTokens = WakewordDetector.tokenize(normalizedText);
    return this.findPhraseStart(textTokens) !== -1;
  }

  public extractUtterance(text: string): string {
    const normalizedText = WakewordDetector.normalize(text);
    const textTokens = WakewordDetector.tokenize(normalizedText);
    const phraseStart = this.findPhraseStart(textTokens);
    if (phraseStart === -1) {
      return text.trim();
    }

    return textTokens.slice(phraseStart + this.phraseTokens.length).join(" ").trim();
  }

  public get phraseValue(): string {
    return this.phrase;
  }

  private static normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private findPhraseStart(textTokens: string[]): number {
    if (this.phraseTokens.length === 0 || textTokens.length < this.phraseTokens.length) {
      return -1;
    }

    for (let i = 0; i <= textTokens.length - this.phraseTokens.length; i += 1) {
      let allMatch = true;
      for (let j = 0; j < this.phraseTokens.length; j += 1) {
        if (!WakewordDetector.tokenMatches(this.phraseTokens[j], textTokens[i + j])) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        return i;
      }
    }

    return -1;
  }

  private static tokenize(value: string): string[] {
    return value.split(" ").filter(Boolean);
  }

  private static tokenMatches(expected: string, actual: string): boolean {
    if (expected === actual) {
      return true;
    }

    const expectedCanonical = WakewordDetector.canonicalizeToken(expected);
    const actualCanonical = WakewordDetector.canonicalizeToken(actual);
    if (expectedCanonical === actualCanonical) {
      return true;
    }

    const maxLength = Math.max(expected.length, actual.length);
    const maxDistance = WakewordDetector.allowedDistance(maxLength);
    if (maxDistance === 0) {
      return false;
    }

    return WakewordDetector.levenshteinDistance(expected, actual) <= maxDistance;
  }

  private static allowedDistance(maxLength: number): number {
    if (maxLength <= 3) {
      return 0;
    }
    if (maxLength <= 5) {
      return 1;
    }
    if (maxLength <= 7) {
      return 3;
    }
    return 4;
  }

  private static canonicalizeToken(value: string): string {
    return value
      .replace(/^v/u, "b")
      .replace(/^w/u, "b")
      .replace(/ri/gu, "l")
      .replace(/di/gu, "i")
      .replace(/ll/gu, "y")
      .replace(/z/gu, "s")
      .replace(/h/gu, "");
  }

  private static levenshteinDistance(a: string, b: string): number {
    if (a === b) {
      return 0;
    }
    if (!a.length) {
      return b.length;
    }
    if (!b.length) {
      return a.length;
    }

    const row = Array.from({ length: b.length + 1 }, (_, idx) => idx);

    for (let i = 1; i <= a.length; i += 1) {
      let prevDiagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const temp = row[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min(
          row[j] + 1,
          row[j - 1] + 1,
          prevDiagonal + cost,
        );
        prevDiagonal = temp;
      }
    }

    return row[b.length];
  }
}
