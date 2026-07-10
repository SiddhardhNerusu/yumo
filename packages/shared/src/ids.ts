/**
 * Branded id types — prevent mixing a FoodId with a RecipeId or a raw string
 * at compile time. Zero runtime cost.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type FoodId = Brand<string, 'FoodId'>;
export type RecipeId = Brand<string, 'RecipeId'>;
/** USDA FoodData Central id. */
export type FdcId = Brand<number, 'FdcId'>;

export const FoodId = (s: string): FoodId => s as FoodId;
export const RecipeId = (s: string): RecipeId => s as RecipeId;
export const FdcId = (n: number): FdcId => n as FdcId;
