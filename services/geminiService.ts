
import { GoogleGenAI, Type } from "@google/genai";
import { RecipeInput, MasterRecipe } from "../types";

/**
 * SERVICE FOR RECIPE CONTENT GENERATION
 * Optimized for Gallina Blanca Brand Voice & SEO
 */

export const DEFAULT_SYSTEM_PROMPT = `Eres el Editor Jefe de Gallina Blanca. Tu estilo es PRÁCTICO, CERCANO y EXPERTO, pero sobre todo NATURAL.

MANDAMIENTOS DE REDACCIÓN (CRÍTICOS):

1. PROHIBIDO HABLAR EN PRIMERA PERSONA DEL SINGULAR ("YO"):
   - JAMÁS digas "A mí me encanta", "Yo recomiendo", "Mi consejo", "Me gusta".
   - USA SIEMPRE la voz de marca ("En Gallina Blanca nos encanta...", "Te recomendamos...") o estructuras impersonales ("Es ideal para...", "Esta receta destaca por...", "Se aconseja...").

2. NATURALIDAD EXTREMA Y EL TABÚ DE "RECETA FÁCIL":
   - CUIDADO con keywords tipo "receta fácil", "rápida" o "casera". Usarlas tal cual a veces suena a robot.
   - MAL: "Prepara esta receta fácil de pollo". (Suena forzado).
   - BIEN: "Verás qué fácil es preparar este pollo", "Una opción sencillísima", "Si buscas algo simple...".
   - TU OBJETIVO: Que parezca escrito por una persona real, no por una máquina de SEO. Rompe la keyword si es necesario para que la frase fluya.

3. LENGUAJE SIMPLE (CERO COMPLEJIDAD):
   - PROHIBIDO usar palabras rebuscadas, cultismos o construcciones complejas.
   - Usa un vocabulario llano, el que usarías explicando la receta a un amigo mientras cocináis.
   - Frases cortas y directas. Si una frase cuesta leerla, bórrala.

4. GESTIÓN INTELIGENTE DE KEYWORDS (CONCLUSIÓN):
   - NO EMBUTAS palabras clave.
   - Si en la Conclusión tienes varias keywords y al ponerlas el texto queda repetitivo o "pastoso", IGNORA LAS QUE SOBREN.
   - Es inaceptable una conclusión que parezca una lista de términos SEO. Prioriza un cierre inspirador y útil sobre el SEO.

5. FILOSOFÍA DE MARCA:
   - Valoramos la tradición pero promovemos la cocina inteligente con productos Gallina Blanca.
   - Tono humilde y servicial. Somos el pinche que ayuda, no el chef estrella.

6. FORMATO:
   - Nunca incluyas números entre paréntesis (ej: "(1)") en el texto.
   - Párrafos breves y aireados.`;

export const DEFAULT_USER_PROMPT_TEMPLATE = `
Genera el contenido SEO para la receta: "{{heroKW}}".

DATOS ESTRATÉGICOS:
- Receta Principal: {{heroKW}}
- Producto Gallina Blanca: {{gbIngredient}}
- Keyword Principal (TOP): {{topKeyword}}
- Keywords Secundarias (Introducción): {{secondaryKws}}
- Keywords de Conclusión: {{conclusionKws}}
- FAQs SEMRush: {{faqsSemrush}}
- FAQs Contenido: {{faqsList}}
- Ingredientes: {{ingredientes}}
- Nº Pasos: {{numPasos}}

DATOS DE INTERLINKING (Opcional):
- Candidatas a recetas relacionadas: {{relatedRecipesCandidates}}

REQUERIMIENTOS SEO Y ESTRUCTURA EDITORIAL (CALIDAD MÁXIMA):

1. INTRODUCCIÓN (3 párrafos):
   - Párrafo 1: Menciona "{{heroKW}}" y "{{gbIngredient}}" de forma muy casual. Tono humilde. Usa "En Gallina Blanca..." si es necesario, nunca "Yo".
   - Párrafo 2: Breve contexto o curiosidad (muy breve).
   - Párrafo 3: Integra las keywords secundarias ("{{secondaryKws}}").
   - IMPORTANTE: Si una keyword es "receta fácil" o similar y suena artificial, DILÚYELA en la frase. Ejemplo: en vez de "esta receta fácil de arroz", di "hacer este arroz es facilísimo". Prioriza la lectura natural.

2. PASO A PASO: 
   - Exactamente {{numPasos}} pasos detallados.
   - Cada paso debe tener una extensión mínima de 2 párrafos.
   - Lenguaje directo e instructivo.

3. NUTRICIÓN: 
   - Genera una tabla HTML con valores realistas.

4. CONCLUSIÓN (2 párrafos):
   - Céntrate en cómo servir el plato y sugerencias de acompañamiento. 
   - NO hables de bebidas ni alcohol. Prohibido usar la palabra "guía".
   - Integra las keywords ("{{conclusionKws}}") SOLO SI ENTRAN DE FORMA NATURAL.
   - REGLA DE ORO: Si sientes que metes demasiadas keywords a la vez o se hace repetitivo, OBVIA ALGUNAS. No fuerces. Queremos lenguaje natural.

5. RECETAS RELACIONADAS (Párrafo de Interlinking):
   - Si hay candidatas, redacta UN SOLO PÁRRAFO sutil sugiriendo variaciones. 
   - CANTIDAD: Selecciona obligatoriamente un mínimo de 3 y un máximo de 4 recetas de la lista de candidatas.
   - REGLA DE ORO: Los enlaces DEBEN usar exclusivamente etiquetas HTML <a> (ejemplo: <a href="URL">Nombre de la Receta</a>). 
   - PROHIBICIÓN ABSOLUTA: No utilices formato Markdown [texto](url) bajo ningún concepto. 
   - INTEGRACIÓN: Los enlaces <a> deben estar integrados NATURALMENTE dentro del flujo del texto.

6. FAQs MAESTRAS: 
   - Mínimo de 8 FAQs combinando "{{faqsSemrush}}" y "{{faqsList}}". Respuestas directas y útiles.

RESPONDE EXCLUSIVAMENTE EN FORMATO JSON:
{
  "introduccion": "html_string",
  "nutrientes": {
    "tablaHtml": "html_table",
    "energia": "string",
    "hidratos": "string",
    "fibra": "string",
    "proteinas": "string",
    "grasas": "string"
  },
  "pasos": [{ "title": "string", "content": "html_con_minimo_dos_parrafos_por_paso" }],
  "conclusion": "html_string",
  "relatedRecipesHtml": "html_string_con_un_unico_parrafo_y_enlaces_en_etiquetas_a",
  "faqs": [{ "question": "string", "answer": "string" }]
}
`;

export const generateRecipeContent = async (recipe: RecipeInput, masterList: MasterRecipe[] = []) => {
  const clean = (text: string) => text ? text.replace(/\s*\(\d+\)/g, '').trim() : '';

  const heroKW = clean(recipe.heroKeyword);
  const gbIngredient = clean(recipe.gbProduct); 
  const topKeyword = clean(recipe.topKeyword);
  const secondaryKws = clean(recipe.secondaryKws);
  const conclusionKws = clean(recipe.conclusionKws);

  // Lógica de matching local para el Master List
  let candidatesText = "No hay recetas relacionadas disponibles.";
  if (masterList.length > 0) {
    const keywords = heroKW.toLowerCase().split(' ').filter(k => k.length > 3);
    const matches = masterList
      .filter(m => keywords.some(k => m.name.toLowerCase().includes(k)) && m.name.toLowerCase() !== heroKW.toLowerCase())
      .slice(0, 10);
    
    if (matches.length > 0) {
      candidatesText = matches.map(m => `- ${m.name} (URL: ${m.url})`).join('\n');
    }
  }

  const provider = localStorage.getItem('aerogen_ai_provider') || 'gemini';
  const model = localStorage.getItem('aerogen_ai_model') || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-3-flash-preview');
  
  const openAiKey = localStorage.getItem('aerogen_openai_key');
  const anthropicKey = localStorage.getItem('aerogen_anthropic_key');

  const systemPrompt = localStorage.getItem('gb_system_prompt') || DEFAULT_SYSTEM_PROMPT;
  const rawTemplate = localStorage.getItem('gb_user_prompt_template') || DEFAULT_USER_PROMPT_TEMPLATE;

  const userPrompt = rawTemplate
    .replace(/{{heroKW}}/g, heroKW)
    .replace(/{{gbIngredient}}/g, gbIngredient)
    .replace(/{{topKeyword}}/g, topKeyword)
    .replace(/{{secondaryKws}}/g, secondaryKws)
    .replace(/{{conclusionKws}}/g, conclusionKws)
    .replace(/{{faqsSemrush}}/g, recipe.faqsSemrush || '')
    .replace(/{{faqsList}}/g, recipe.faqsList || '')
    .replace(/{{ingredientes}}/g, recipe.ingredientes || '')
    .replace(/{{numPasos}}/g, String(recipe.numPasos || 3))
    .replace(/{{relatedRecipesCandidates}}/g, candidatesText);

  const extractJson = (text: string) => {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON from AI response:", text);
      throw new Error("La IA no devolvió un formato JSON válido.");
    }
  };

  try {
    if (provider === 'gemini') {
      // Prioriza la clave guardada en el navegador (input del usuario), si no, usa la del entorno
      const apiKey = localStorage.getItem('aerogen_gemini_key') || process.env.API_KEY;
      
      if (!apiKey) throw new Error("Falta la API Key de Gemini. Introdúcela en el menú lateral o configura process.env.API_KEY.");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          temperature: 0.7,
        }
      });
      return extractJson(response.text);

    } else if (provider === 'anthropic') {
      if (!anthropicKey) throw new Error("Falta Anthropic API Key.");

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        throw new Error(`Anthropic Error ${response.status}: ${errorDetail}`);
      }
      
      const data = await response.json();
      return extractJson(data.content[0].text);

    } else {
      if (!openAiKey) throw new Error("Falta OpenAI API Key.");

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        throw new Error(`OpenAI Error ${response.status}: ${errorDetail}`);
      }
      
      const data = await response.json();
      return extractJson(data.choices[0].message.content);
    }
  } catch (error: any) {
    throw new Error(error.message || "Error al generar contenido");
  }
};
