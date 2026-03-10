export class WakewordDetector {
  private readonly normalizedPhrase: string;

  constructor(private readonly phrase: string) {
    this.normalizedPhrase = WakewordDetector.normalize(phrase);
    if (!this.normalizedPhrase) {
      throw new Error("Wake phrase cannot be empty");
    }
  }

  public matches(text: string): boolean {
    const normalizedText = WakewordDetector.normalize(text);
    return normalizedText.includes(this.normalizedPhrase);
  }

  public extractUtterance(text: string): string {
    const normalizedText = WakewordDetector.normalize(text);
    const phraseIndex = normalizedText.indexOf(this.normalizedPhrase);
    if (phraseIndex === -1) {
      return text.trim();
    }

    const tail = normalizedText.slice(phraseIndex + this.normalizedPhrase.length).trim();
    return tail;
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
}
