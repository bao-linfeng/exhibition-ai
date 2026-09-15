import type { PromptSnapshot } from '../types.js';

export interface PromptTemplate {
  id: string;
  version: string;
  text: string;
}

function render(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? (variables[key] as string)
      : `{{${key}}}`;
  });
}

export class PromptRegistry {
  private readonly templates = new Map<string, PromptTemplate>();

  register(template: PromptTemplate): this {
    this.templates.set(template.id, template);
    return this;
  }

  snapshot(
    templateId: string,
    variables: Record<string, string>,
  ): PromptSnapshot {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Prompt template not found: ${templateId}`);
    }
    const renderedText = render(template.text, variables);
    return {
      templateId: template.id,
      version: template.version,
      templateText: template.text,
      renderedText,
      variables,
      snapshotAt: new Date().toISOString(),
    };
  }

  listMetadata(): Array<{ id: string; version: string }> {
    return Array.from(this.templates.values()).map((template) => ({
      id: template.id,
      version: template.version,
    }));
  }
}

export const defaultRegistry = new PromptRegistry();
