export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  searchTerms: string[];
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  time: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export const dailyRecipes: Recipe[] = [
  {
    id: 'salada-colorida',
    name: 'Salada colorida da estação',
    description: 'Uma salada fresca e crocante para acompanhar o almoço.',
    time: '15 min',
    servings: 4,
    ingredients: [
      { name: 'Alface', quantity: 1, unit: 'unidade', searchTerms: ['alface'] },
      { name: 'Tomate', quantity: 3, unit: 'unidades', searchTerms: ['tomate'] },
      { name: 'Cenoura', quantity: 2, unit: 'unidades', searchTerms: ['cenoura'] },
      { name: 'Limão', quantity: 2, unit: 'unidades', searchTerms: ['limão', 'limao'] },
    ],
    steps: [
      'Lave e seque as folhas e os legumes.',
      'Rale a cenoura e corte os tomates em pedaços.',
      'Misture tudo e tempere com limão, azeite, sal e pimenta a gosto.',
    ],
  },
  {
    id: 'macarrao-carne',
    name: 'Macarrão com molho de carne',
    description: 'Uma refeição prática e querida para compartilhar.',
    time: '35 min',
    servings: 4,
    ingredients: [
      { name: 'Macarrão', quantity: 500, unit: 'g', searchTerms: ['macarrão', 'macarrao', 'espaguete'] },
      { name: 'Carne moída', quantity: 500, unit: 'g', searchTerms: ['carne moída', 'carne moida', 'patinho moído', 'patinho moido'] },
      { name: 'Molho de tomate', quantity: 1, unit: 'embalagem', searchTerms: ['molho de tomate'] },
      { name: 'Cebola', quantity: 1, unit: 'unidade', searchTerms: ['cebola'] },
      { name: 'Alho', quantity: 2, unit: 'dentes', searchTerms: ['alho'] },
    ],
    steps: [
      'Cozinhe o macarrão conforme as instruções da embalagem.',
      'Refogue a cebola e o alho, acrescente a carne e cozinhe até dourar.',
      'Junte o molho de tomate, deixe apurar e sirva com o macarrão.',
    ],
  },
  {
    id: 'panqueca-banana',
    name: 'Panqueca de banana',
    description: 'Uma ideia simples para o café da manhã ou lanche.',
    time: '20 min',
    servings: 2,
    ingredients: [
      { name: 'Banana', quantity: 2, unit: 'unidades', searchTerms: ['banana'] },
      { name: 'Ovos', quantity: 2, unit: 'unidades', searchTerms: ['ovo', 'ovos'] },
      { name: 'Aveia', quantity: 4, unit: 'colheres', searchTerms: ['aveia'] },
      { name: 'Canela', quantity: 1, unit: 'pitada', searchTerms: ['canela'] },
    ],
    steps: [
      'Amasse as bananas e misture com os ovos e a aveia.',
      'Aqueça uma frigideira untada e doure pequenas porções dos dois lados.',
      'Finalize com canela e sirva ainda morna.',
    ],
  },
];
