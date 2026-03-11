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
    return this.findPhraseMatch(textTokens) !== null;
  }

  public extractUtterance(text: string): string {
    const normalizedText = WakewordDetector.normalize(text);
    const textTokens = WakewordDetector.tokenize(normalizedText);
    const phraseMatch = this.findPhraseMatch(textTokens);
    if (!phraseMatch) {
      return text.trim();
    }

    return textTokens.slice(phraseMatch.endExclusive).join(" ").trim();
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

  private findPhraseMatch(
    textTokens: string[],
  ): { start: number; endExclusive: number } | null {
    if (this.phraseTokens.length === 0 || textTokens.length < this.phraseTokens.length) {
      return null;
    }

    for (let i = 0; i <= textTokens.length - this.phraseTokens.length; i += 1) {
      const endExclusive = this.matchFrom(i, 0, textTokens);
      if (endExclusive !== -1) {
        return {
          start: i,
          endExclusive,
        };
      }
    }

    return null;
  }

  private matchFrom(
    textIndex: number,
    phraseIndex: number,
    textTokens: string[],
  ): number {
    if (phraseIndex >= this.phraseTokens.length) {
      return textIndex;
    }

    if (textIndex >= textTokens.length) {
      return -1;
    }

    const expectedToken = this.phraseTokens[phraseIndex];
    const oneToken = textTokens[textIndex];
    if (WakewordDetector.tokenMatches(expectedToken, oneToken)) {
      const oneTokenResult = this.matchFrom(textIndex + 1, phraseIndex + 1, textTokens);
      if (oneTokenResult !== -1) {
        return oneTokenResult;
      }
    }

    // Some ASR outputs split one keyword in two tokens: "vari vis" vs "veridis".
    if (textIndex + 1 < textTokens.length) {
      const twoTokenMerged = `${textTokens[textIndex]}${textTokens[textIndex + 1]}`;
      if (WakewordDetector.tokenMatches(expectedToken, twoTokenMerged)) {
        const twoTokenResult = this.matchFrom(textIndex + 2, phraseIndex + 1, textTokens);
        if (twoTokenResult !== -1) {
          return twoTokenResult;
        }
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
