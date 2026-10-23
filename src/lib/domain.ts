import "server-only";

export type Provider = { id: number; name: string; created_at: string; updated_at: string };

export type Model = {
  id: number;
  name: string;
  llm_provider_id: number;
  provider_model_id: string;
  is_temperature_supported: boolean;
  created_at: string;
  updated_at: string;
};

export type Chain = {
  id: number;
  slug: string;
  description: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type Step = {
  id: number;
  prompt_chain_id: number;
  step_order: number;
  description: string | null;
  step_type: string;
  input_type: string;
  output_type: string;
  llm_model_id: number;
  llm_temperature: number | null;
  system_prompt: string | null;
  user_prompt: string | null;
  is_hidden: boolean;
};

export type Mix = { id: number; prompt_chain_id: number; caption_count: number; updated_at: string };

export type TermType = { id: number; name: string };

export type Term = {
  id: number;
  term: string;
  definition: string;
  example: string | null;
  priority: number;
  term_type_id: number | null;
  updated_at: string;
};

export type Example = {
  id: number;
  image_description: string;
  caption: string;
  explanation: string | null;
  priority: number;
  image_id: number | null;
  updated_at: string;
};

export type Domain = { id: number; apex_domain: string; created_at: string; updated_at: string };
export type AllowedEmail = { id: number; email_address: string; created_at: string; updated_at: string };

export const STEP_TYPE_LABEL: Record<string, string> = {
  describe_image: "Describe image",
  generate_captions: "Generate captions",
  judge: "Judge",
  rewrite: "Rewrite",
};
