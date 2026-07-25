export type StudyPassageConfig = {
  id: string;
  weekLabel: string;
  scriptureLabel: string;
  descriptionLabel: string;
  displayOrder: number;
};

export const DEFAULT_STUDY_PASSAGES: StudyPassageConfig[] = [
  { id: "week-10", weekLabel: "Week 10", scriptureLabel: "John 3:1–15", descriptionLabel: "Jesus and Nicodemus", displayOrder: 10 },
  { id: "week-11", weekLabel: "Week 11", scriptureLabel: "John 3:16–21", descriptionLabel: "God so loved the world", displayOrder: 11 },
  { id: "week-12", weekLabel: "Week 12", scriptureLabel: "John 3:22–36", descriptionLabel: "He must increase", displayOrder: 12 },
  { id: "week-13", weekLabel: "Week 13", scriptureLabel: "John 4:1–15", descriptionLabel: "Living water", displayOrder: 13 },
  { id: "week-14", weekLabel: "Week 14", scriptureLabel: "John 4:16–30", descriptionLabel: "Come, see a man", displayOrder: 14 },
  { id: "week-15", weekLabel: "Week 15", scriptureLabel: "John 4:31–38", descriptionLabel: "The fields are ripe", displayOrder: 15 },
  { id: "week-16", weekLabel: "Week 16", scriptureLabel: "John 4:39–42", descriptionLabel: "Savior of the world", displayOrder: 16 },
  { id: "week-17", weekLabel: "Week 17", scriptureLabel: "John 4:43–54", descriptionLabel: "The official’s son", displayOrder: 17 },
  { id: "week-18", weekLabel: "Week 18", scriptureLabel: "John 5:1–18", descriptionLabel: "Healing at Bethesda", displayOrder: 18 },
  { id: "week-19", weekLabel: "Week 19", scriptureLabel: "John 5:19–24", descriptionLabel: "The Son gives life", displayOrder: 19 },
  { id: "week-20", weekLabel: "Week 20", scriptureLabel: "John 5:25–29", descriptionLabel: "Life and judgment", displayOrder: 20 },
  { id: "week-21", weekLabel: "Week 21", scriptureLabel: "John 5:30–46", descriptionLabel: "Witnesses to Jesus", displayOrder: 21 },
];
