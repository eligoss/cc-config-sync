import { createInterface } from "node:readline";

/**
 * Ask a question via readline and return the trimmed, lowercased answer.
 * Creates and closes the readline interface for each call.
 */
export function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}
