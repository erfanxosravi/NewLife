import { validateAllJsonData } from '../src/data/registry';

try {
  const dataset = validateAllJsonData();
  console.log(
    `[validate-data] OK — cities: ${dataset.cities.length}, jobs: ${dataset.jobs.length}, licenses: ${dataset.businesses.licenses.length}, businesses: ${dataset.businesses.businesses.length}, countries: ${dataset.countries.length}, achievements: ${dataset.achievements.length}, events: ${dataset.events.length}, activities: ${dataset.activities.length}, shop: ${dataset.shop.length}, skills: ${dataset.skills.length}, housing: ${dataset.housing.housingListings.length}, vehicles: ${dataset.housing.vehicleCatalog.length}, inheritanceArticles: ${dataset.inheritance.meta.civilCodeArticles.length}`,
  );
} catch (error) {
  console.error('[validate-data] JSON schema validation failed:', error);
  process.exit(1);
}
