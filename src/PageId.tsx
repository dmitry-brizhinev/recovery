
export const PageIds = [
  'todo',
  'plan',
  'oneoff',
  'exerc',
  'resea',
  'buy',
  'think',
  'psych',
  'eggy',
  'other',
] as const;

export type PageId = typeof PageIds[number];
type PageTitlesType = {
  [key in PageId]: string;
};

export const PageTitles: PageTitlesType = {
  todo: 'One-offs todo:',
  plan: 'Concrete plans to schedule:',
  oneoff: 'Ideas for one-offs:',
  exerc: 'Ideas for plans/recurring/exercises to try:',
  resea: 'To research:',
  buy: 'To buy:',
  think: 'To think about:',
  psych: 'To discuss with psych:',
  eggy: 'To discuss with Eggy:',
  other: 'Other:',
} as const;
