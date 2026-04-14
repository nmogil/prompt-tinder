import type { OptimizerInput, OptimizerOutput } from "../optimizerValidation";

export interface GoldenFixture {
  name: string;
  description: string;
  input: OptimizerInput;
  referenceOutput: OptimizerOutput;
}

export const GOLDEN_FIXTURES: GoldenFixture[] = [
  // ──────────────────────────────────────────────
  // 1. Customer support tone adjustment
  // ──────────────────────────────────────────────
  {
    name: "Customer support tone adjustment",
    description:
      "Feedback says outputs are too formal; metaContext defines a friendly-but-professional brand voice.",
    input: {
      currentSystemMessage:
        "You are a helpful customer support agent. Answer the user's question.",
      currentUserTemplate: "Customer message: {{message}}",
      projectVariables: [
        { name: "message", required: true, description: "The customer's message" },
      ],
      outputFeedback: [
        {
          blindLabel: "A",
          highlightedText:
            "Dear valued customer, I appreciate your inquiry.",
          comment: "Too formal. We want friendly but professional.",
        },
        {
          blindLabel: "B",
          highlightedText: "I understand your concern and will assist you.",
          comment: "Still reads like a form letter.",
        },
      ],
      promptFeedback: [],
      metaContext: [
        {
          question: "Brand voice?",
          answer:
            "Friendly but professional. Warm, not stiff. Think helpful coworker, not corporate robot.",
        },
      ],
    },
    referenceOutput: {
      newSystemMessage:
        "You are a customer support agent. Be friendly and professional — like a helpful coworker, not a corporate robot. Avoid formal openers ('Dear valued customer') and form-letter phrases ('I understand your concern'). Get to the point and be warm.",
      newUserTemplate: "Customer message: {{message}}",
      changesSummary:
        "- Rewrote system message to enforce friendly-but-professional tone\n- Added explicit prohibitions against formal openers and form-letter language\n- User template unchanged — feedback targets output behavior, not input structure",
      changesReasoning:
        "Output A was flagged as 'too formal' — the evaluator highlighted 'Dear valued customer, I appreciate your inquiry.' Output B received similar feedback: 'still reads like a form letter' on 'I understand your concern and will assist you.' Both converge on tone drift from the brand voice. The meta-context defines the voice as 'friendly but professional — warm, not stiff — helpful coworker, not corporate robot.' The current system_message ('helpful customer support agent') does not enforce this. The rewrite names the anti-patterns and adds the positive instruction from the meta-context.",
    },
  },

  // ──────────────────────────────────────────────
  // 2. Translation accuracy — system message creation
  // ──────────────────────────────────────────────
  {
    name: "Translation accuracy with system message creation",
    description:
      "Feedback on Output B cites poor idiomatic phrasing. No system message exists yet — one needs to be created.",
    input: {
      currentSystemMessage: null,
      currentUserTemplate:
        "Translate the following text from English to French: {{text}}",
      projectVariables: [
        { name: "text", required: true, description: "Source text to translate" },
      ],
      outputFeedback: [
        {
          blindLabel: "B",
          highlightedText: "Casser sa pipe",
          comment:
            "Translated 'kick the bucket' literally. Should use the French idiomatic equivalent, not a word-for-word rendering.",
        },
      ],
      promptFeedback: [],
      metaContext: [
        {
          question: "Intended audience?",
          answer: "Native French speakers reading casual prose.",
        },
      ],
    },
    referenceOutput: {
      newSystemMessage:
        "You are a translator. Render English text into natural, idiomatic French suitable for native speakers. When the source contains idioms or colloquial expressions, translate them to their closest French equivalent — never translate literally.",
      newUserTemplate:
        "Translate the following text from English to French: {{text}}",
      changesSummary:
        "- Created a system message requiring idiomatic translation\n- Added explicit rule against literal idiom translation\n- User template unchanged — the issue is behavioral",
      changesReasoning:
        "Output B contained 'Casser sa pipe' as a literal translation of 'kick the bucket.' The evaluator explicitly asked for idiomatic equivalents rather than word-for-word translation. The project had no system_message, so nothing governed translation style. The meta-context confirms the audience is native French speakers reading casual prose, reinforcing that idiomatic rendering is the correct approach. A system message is the right fix because the problem is a class of errors, not one phrasing issue.",
    },
  },

  // ──────────────────────────────────────────────
  // 3. Classification prompt — confusing categories
  // ──────────────────────────────────────────────
  {
    name: "Classification prompt with confusing categories",
    description:
      "Feedback says the category definitions are unclear. Required variable {{categories}} must be preserved.",
    input: {
      currentSystemMessage:
        "You are a text classifier. Classify the input into exactly one of the provided categories.",
      currentUserTemplate:
        "Categories: {{categories}}\n\nText to classify: {{input_text}}",
      projectVariables: [
        {
          name: "categories",
          required: true,
          description: "Comma-separated list of valid categories",
        },
        {
          name: "input_text",
          required: true,
          description: "The text to classify",
        },
      ],
      outputFeedback: [
        {
          blindLabel: "A",
          highlightedText: "Category: General Inquiry",
          comment:
            "This was clearly a billing complaint, not a general inquiry. The categories seem to overlap.",
        },
        {
          blindLabel: "C",
          highlightedText: "Category: Support Request",
          comment:
            "Hard to tell the difference between 'Support Request' and 'General Inquiry' from the output. The model seems confused by the categories.",
        },
      ],
      promptFeedback: [
        {
          targetField: "system_message",
          highlightedText: "Classify the input into exactly one",
          comment:
            "Should tell the model what to do when categories seem ambiguous or overlapping.",
        },
      ],
      metaContext: [
        {
          question: "Domain?",
          answer: "Customer support ticket routing for a SaaS company.",
        },
      ],
    },
    referenceOutput: {
      newSystemMessage:
        "You are a customer support ticket classifier for a SaaS company. Classify the input into exactly one of the provided categories. If categories seem to overlap, choose the most specific one. If the input clearly matches a subcategory of a broader category, prefer the narrower match. Output only the category name, nothing else.",
      newUserTemplate:
        "Categories: {{categories}}\n\nText to classify: {{input_text}}",
      changesSummary:
        "- Added disambiguation rules for overlapping categories to the system message\n- Added domain context (SaaS customer support) to the system message\n- Added instruction to output only the category name\n- User template unchanged",
      changesReasoning:
        "Output A misclassified a billing complaint as 'General Inquiry,' and Output C could not distinguish 'Support Request' from 'General Inquiry.' Both point to the model struggling with overlapping categories. Prompt feedback on the system_message requested guidance for 'when categories seem ambiguous or overlapping.' The rewrite adds explicit disambiguation rules: prefer the most specific category, prefer narrower matches. The meta-context specifies SaaS customer support ticket routing, so the system message now includes that domain context for better classification accuracy.",
    },
  },

  // ──────────────────────────────────────────────
  // 4. Summarization length — conflicting feedback
  // ──────────────────────────────────────────────
  {
    name: "Summarization with conflicting length feedback",
    description:
      "Output A is 'too short,' Output C is 'too verbose.' The prompt must balance both.",
    input: {
      currentSystemMessage:
        "You are a text summarizer. Produce concise summaries.",
      currentUserTemplate: "Summarize: {{document}}",
      projectVariables: [
        { name: "document", required: true, description: "The text to summarize" },
        {
          name: "max_length",
          required: false,
          description: "Optional maximum word count for the summary",
        },
      ],
      outputFeedback: [
        {
          blindLabel: "A",
          highlightedText: "The document discusses several key points.",
          comment: "Way too short. Missed all the important details.",
        },
        {
          blindLabel: "C",
          highlightedText:
            "In conclusion, after examining all the multifaceted aspects of this complex topic and considering the various dimensions...",
          comment: "Too verbose and padded. Get to the point.",
        },
      ],
      promptFeedback: [],
      metaContext: [],
    },
    referenceOutput: {
      newSystemMessage:
        "You are a text summarizer. Cover all key points from the source material. Do not pad with filler phrases or unnecessary qualifiers — every sentence must convey information from the source. If a max_length is specified, respect it.",
      newUserTemplate:
        "Summarize the following document. {{max_length}}\n\n{{document}}",
      changesSummary:
        "- Rewrote system message to balance coverage and conciseness\n- Added rule against filler phrases and padding\n- Incorporated optional {{max_length}} variable in user template for length control",
      changesReasoning:
        "Output A was flagged as 'way too short,' missing 'all the important details' — the summary lacked coverage. Output C was called 'too verbose and padded' on a filler-heavy closing. These are not contradictory: they point to a precision problem. The current system_message ('produce concise summaries') optimizes for brevity only, explaining Output A. The rewrite requires covering all key points (addressing A) while prohibiting filler (addressing C). The unused {{max_length}} variable is now incorporated in the user template to give explicit length control.",
    },
  },

  // ──────────────────────────────────────────────
  // 5. Data extraction — missed fields
  // ──────────────────────────────────────────────
  {
    name: "Data extraction with missed fields",
    description:
      "Feedback says the model missed required fields. Required variables {{schema}} and {{document}} must be preserved.",
    input: {
      currentSystemMessage:
        "Extract structured data from the provided document.",
      currentUserTemplate:
        "Schema: {{schema}}\n\nDocument: {{document}}",
      projectVariables: [
        {
          name: "schema",
          required: true,
          description: "JSON schema defining the fields to extract",
        },
        {
          name: "document",
          required: true,
          description: "The source document to extract from",
        },
      ],
      outputFeedback: [
        {
          blindLabel: "A",
          highlightedText: '"phone": null',
          comment:
            "The phone number was clearly in the document: '(555) 123-4567'. The model missed it.",
        },
        {
          blindLabel: "B",
          highlightedText: '"email": null',
          comment:
            "The email was on line 3 of the document. Model returned null instead of extracting it.",
        },
      ],
      promptFeedback: [
        {
          targetField: "system_message",
          highlightedText: "Extract structured data",
          comment:
            "Too vague. Should tell the model to look carefully for every field and not default to null.",
        },
      ],
      metaContext: [
        {
          question: "What domain?",
          answer: "Business contact information extraction from emails and letters.",
        },
      ],
    },
    referenceOutput: {
      newSystemMessage:
        "You are a data extraction assistant specializing in business contact information. Extract every field defined in the schema from the provided document. Search the entire document for each field before returning null — only use null when the information is genuinely absent, not when it requires more careful reading. Prefer extracting partial or approximate data over returning null.",
      newUserTemplate:
        "Schema: {{schema}}\n\nDocument: {{document}}",
      changesSummary:
        "- Rewrote system message with explicit instructions against premature null values\n- Added domain context (business contact extraction)\n- Added rule to search the entire document before defaulting to null\n- User template unchanged",
      changesReasoning:
        "Output A returned null for phone when '(555) 123-4567' was present in the document, and Output B returned null for email when it was on line 3. Both indicate the model is defaulting to null too readily. Prompt feedback on the system_message called it 'too vague' and suggested telling the model to 'look carefully for every field and not default to null.' The rewrite operationalizes this: search the entire document for each field before returning null, prefer partial data over null. The meta-context confirms the domain is business contact extraction from emails and letters.",
    },
  },

  // ──────────────────────────────────────────────
  // 6. Code generation — missing error handling
  // ──────────────────────────────────────────────
  {
    name: "Code generation with missing error handling",
    description:
      "Feedback on Output A cites missing error handling in generated code.",
    input: {
      currentSystemMessage:
        "You are a code generator. Write clean, working code in the specified language.",
      currentUserTemplate:
        "Language: {{language}}\n\nTask: {{task_description}}",
      projectVariables: [
        {
          name: "language",
          required: true,
          description: "Programming language to use",
        },
        {
          name: "task_description",
          required: true,
          description: "Description of what the code should do",
        },
        {
          name: "style_guide",
          required: false,
          description: "Optional coding style preferences",
        },
      ],
      outputFeedback: [
        {
          blindLabel: "A",
          highlightedText: "const data = await fetch(url);",
          comment:
            "No error handling at all. What happens if the fetch fails? Need try/catch and meaningful error messages.",
          model: "anthropic/claude-3.5-sonnet",
          temperature: 0.2,
        },
      ],
      promptFeedback: [],
      metaContext: [
        {
          question: "Code quality expectations?",
          answer: "Production-grade. Must handle errors, edge cases, and include comments for non-obvious logic.",
        },
      ],
    },
    referenceOutput: {
      newSystemMessage:
        "You are a code generator. Write production-grade code in the specified language. Every external call (network, file I/O, database) must include error handling with meaningful error messages. Handle edge cases. Add comments for non-obvious logic. If a style_guide is provided, follow it.",
      newUserTemplate:
        "Language: {{language}}\n\nTask: {{task_description}}\n\n{{style_guide}}",
      changesSummary:
        "- Added explicit error handling requirement to system message\n- Added edge case and commenting requirements per meta-context\n- Incorporated optional {{style_guide}} variable in user template\n- Specified that external calls must have error handling",
      changesReasoning:
        "Output A (generated by anthropic/claude-3.5-sonnet at temperature 0.2) contained 'const data = await fetch(url)' with no error handling — the evaluator explicitly requested try/catch and meaningful error messages. The meta-context requires 'production-grade' code that 'must handle errors, edge cases, and include comments for non-obvious logic.' The current system_message ('write clean, working code') does not enforce any of this. The rewrite adds explicit requirements for error handling on external calls, edge case coverage, and comments. The optional {{style_guide}} variable was defined but unused — incorporating it allows style preferences to be passed through.",
    },
  },

  // ──────────────────────────────────────────────
  // 7. Creative writing — meta-context wins over feedback
  // ──────────────────────────────────────────────
  {
    name: "Creative writing where meta-context constrains",
    description:
      "Meta-context says 'formal academic tone.' Feedback asks for more creativity. Meta-context takes precedence.",
    input: {
      currentSystemMessage:
        "You are a writer. Produce engaging content on the given topic.",
      currentUserTemplate: "Topic: {{topic}}\n\nAudience: {{audience}}",
      projectVariables: [
        { name: "topic", required: true, description: "The writing topic" },
        {
          name: "audience",
          required: true,
          description: "Target audience for the piece",
        },
      ],
      outputFeedback: [
        {
          blindLabel: "A",
          highlightedText:
            "This study examines the implications of recent developments in the field.",
          comment:
            "Dry and boring. Could use more creative flair and engaging hooks.",
        },
        {
          blindLabel: "D",
          highlightedText:
            "The data presented herein suggests a correlation between the variables under consideration.",
          comment:
            "Very stiff. Needs to be more readable and less like a textbook.",
        },
      ],
      promptFeedback: [],
      metaContext: [
        {
          question: "Tone?",
          answer: "Formal academic tone. This is for a peer-reviewed journal.",
        },
        {
          question: "Audience?",
          answer: "Researchers and doctoral students in the field.",
        },
      ],
    },
    referenceOutput: {
      newSystemMessage:
        "You are an academic writer producing content for peer-reviewed journals. Maintain a formal academic tone throughout. While maintaining formality, vary sentence structure and use precise, vivid language to keep the reader engaged. Avoid unnecessarily dense or passive constructions when a direct statement is clearer.",
      newUserTemplate: "Topic: {{topic}}\n\nAudience: {{audience}}",
      changesSummary:
        "- Rewrote system message to specify academic journal context\n- Added instruction to vary sentence structure and use precise language within formal constraints\n- Added rule against unnecessarily dense or passive constructions\n- User template unchanged",
      changesReasoning:
        "Output A was called 'dry and boring' and Output D 'very stiff' and 'like a textbook.' However, the meta-context explicitly requires 'formal academic tone' for a 'peer-reviewed journal' targeting 'researchers and doctoral students.' The meta-context takes precedence over the request for 'creative flair.' The compromise: maintain formal academic tone but improve readability by varying sentence structure, using precise language, and avoiding unnecessarily passive constructions. This addresses the feedback (less stiff, more readable) without violating the meta-context (formal academic for journal publication).",
    },
  },

  // ──────────────────────────────────────────────
  // 8. Q&A with empty metaContext
  // ──────────────────────────────────────────────
  {
    name: "Q&A prompt with empty metaContext",
    description:
      "No meta-context entries. Only output feedback drives changes.",
    input: {
      currentSystemMessage: "You are a question-answering assistant.",
      currentUserTemplate:
        "Question: {{question}}\n\nContext: {{context}}",
      projectVariables: [
        { name: "question", required: true, description: "The user's question" },
        {
          name: "context",
          required: true,
          description: "Relevant context or background material",
        },
      ],
      outputFeedback: [
        {
          blindLabel: "B",
          highlightedText:
            "Based on the information provided, the answer is approximately 42.",
          comment:
            "Don't hedge with 'approximately' when the context gives an exact number. Be precise.",
        },
        {
          blindLabel: "C",
          highlightedText:
            "I'm not sure, but I think the answer might be related to...",
          comment:
            "Too wishy-washy. If the answer is in the context, state it confidently. If not, say so clearly.",
        },
      ],
      promptFeedback: [],
      metaContext: [],
    },
    referenceOutput: {
      newSystemMessage:
        "You are a question-answering assistant. When the answer is clearly supported by the provided context, state it directly and precisely — no hedging ('approximately,' 'I think,' 'might be'). When the context does not contain the answer, say so explicitly rather than guessing.",
      newUserTemplate:
        "Question: {{question}}\n\nContext: {{context}}",
      changesSummary:
        "- Added precision rule: state answers directly when context supports them\n- Added anti-hedging instruction with specific examples of hedging language to avoid\n- Added rule for when context does not contain the answer",
      changesReasoning:
        "Output B hedged with 'approximately' when the context contained an exact number, and Output C was 'too wishy-washy' with 'I'm not sure, but I think.' Both point to the same problem: the model hedges unnecessarily. The current system_message gives no guidance on confidence calibration. The rewrite adds explicit rules: be precise when the context supports an answer, be explicit when it does not. No meta-context was provided, so the changes are driven entirely by the output feedback.",
    },
  },

  // ──────────────────────────────────────────────
  // 9. Single feedback item, no prompt feedback
  // ──────────────────────────────────────────────
  {
    name: "Single feedback item with no prompt feedback",
    description:
      "Only one piece of output feedback. No prompt feedback. Targeted change only.",
    input: {
      currentSystemMessage:
        "You are an email drafting assistant. Write professional emails.",
      currentUserTemplate:
        "Recipient: {{recipient}}\nSubject: {{subject}}\nKey points: {{key_points}}",
      projectVariables: [
        { name: "recipient", required: true, description: "Who the email is to" },
        { name: "subject", required: true, description: "Email subject line" },
        {
          name: "key_points",
          required: true,
          description: "Bullet points to include in the email",
        },
      ],
      outputFeedback: [
        {
          blindLabel: "D",
          highlightedText:
            "Please do not hesitate to reach out if you have any questions or concerns.",
          comment:
            "Cliche closing. Use something more specific to the subject matter.",
        },
      ],
      promptFeedback: [],
      metaContext: [
        {
          question: "Email style?",
          answer: "Direct, professional, no filler phrases or corporate cliches.",
        },
      ],
    },
    referenceOutput: {
      newSystemMessage:
        "You are an email drafting assistant. Write direct, professional emails. Avoid corporate cliches and filler phrases ('please do not hesitate to reach out,' 'I hope this email finds you well'). Closings should be specific to the subject matter, not generic.",
      newUserTemplate:
        "Recipient: {{recipient}}\nSubject: {{subject}}\nKey points: {{key_points}}",
      changesSummary:
        "- Added anti-cliche rule to system message with specific examples\n- Added instruction for subject-specific closings\n- User template unchanged",
      changesReasoning:
        "Output D contained the cliche closing 'Please do not hesitate to reach out if you have any questions or concerns,' which the evaluator called out and asked for 'something more specific to the subject matter.' The meta-context reinforces this: 'direct, professional, no filler phrases or corporate cliches.' The current system_message says only 'write professional emails' without any anti-cliche guidance. The rewrite adds explicit prohibitions against common cliches and requires subject-specific closings.",
    },
  },

  // ──────────────────────────────────────────────
  // 10. Optional variable drop justified by feedback
  // ──────────────────────────────────────────────
  {
    name: "Optional variable drop justified by feedback",
    description:
      "Feedback justifies removing an optional variable that was causing confusion in outputs.",
    input: {
      currentSystemMessage:
        "You are a product description writer. Write compelling descriptions.",
      currentUserTemplate:
        "Product: {{product_name}}\nFeatures: {{features}}\nCompetitor comparison: {{competitor_info}}",
      projectVariables: [
        {
          name: "product_name",
          required: true,
          description: "Name of the product",
        },
        {
          name: "features",
          required: true,
          description: "Key product features",
        },
        {
          name: "competitor_info",
          required: false,
          description: "Optional competitor comparison data",
        },
      ],
      outputFeedback: [
        {
          blindLabel: "A",
          highlightedText:
            "Unlike our competitors who lack these features...",
          comment:
            "The competitor comparison feels forced and negative. When there's no real competitor data, the model makes things up.",
        },
        {
          blindLabel: "B",
          highlightedText:
            "While other products in the market may offer similar capabilities...",
          comment:
            "Vague competitor references that add nothing. Better to focus on the product itself.",
        },
      ],
      promptFeedback: [
        {
          targetField: "user_message_template",
          highlightedText: "Competitor comparison: {{competitor_info}}",
          comment:
            "This field causes more harm than good. When left empty, the model still tries to make comparisons. Remove it from the template.",
        },
      ],
      metaContext: [
        {
          question: "Writing goal?",
          answer: "Highlight product strengths. Avoid negative comparisons or competitor bashing.",
        },
      ],
    },
    referenceOutput: {
      newSystemMessage:
        "You are a product description writer. Write compelling descriptions that highlight the product's strengths. Focus on what the product does well — do not compare to competitors or reference the competition. Keep the tone positive and feature-focused.",
      newUserTemplate:
        "Product: {{product_name}}\nFeatures: {{features}}",
      changesSummary:
        "- Removed optional {{competitor_info}} from user template per feedback\n- Added system message rule against competitor comparisons\n- Added positive, feature-focused writing instruction\n- Rewrote system message with domain-specific guidance",
      changesReasoning:
        "Output A contained forced competitor bashing ('Unlike our competitors who lack these features') and Output B had vague competitor references that 'add nothing.' Prompt feedback on the user_message_template explicitly requested removing the {{competitor_info}} field because 'when left empty, the model still tries to make comparisons.' The variable is optional (required: false), so removing it is allowed. The meta-context says to 'avoid negative comparisons or competitor bashing,' which further supports this removal. The system message now explicitly prohibits competitor references and redirects focus to product strengths.",
    },
  },
];
