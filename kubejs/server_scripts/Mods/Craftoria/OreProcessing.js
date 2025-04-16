ServerEvents.recipes(event => {
  const { occultism } = event.recipes;
  const mekanism = MekanismHelper(event);

  for (let [entry, ore] of Object.entries(global.customOres)) {
    let oreVariants = {
      stone: `${entry}_ore`,
      deepslate: `deepslate_${entry}_ore`,
      nether: `nether_${entry}_ore`,
      end: `end_${entry}_ore`,
    };

    for (let [variant, oreId] of Object.entries(oreVariants)) {
      if (ore.worldGen[variant] === true) {
        occultism.crushing(RecipeResult.of(`craftoria:${entry}_dust`, 4), `craftoria:${oreId}`);

        mekanism.enriching(`2x craftoria:${entry}_dust`, `craftoria:${oreId}`);

        event.smelting(`craftoria:${entry}_ingot`, `craftoria:${oreId}`);
      }
    }
    occultism.crushing(RecipeResult.of(`craftoria:${entry}_dust`, 2), `craftoria:raw_${entry}`);

    mekanism.crushing(`craftoria:${entry}_dust`, `craftoria:raw_${entry}`);
    mekanism.enriching(`4x craftoria:${entry}_dust`, `3x craftoria:raw_${entry}`);

    event.smelting('craftoria:akite_ingot', 'craftoria:akite_dust');
    event.smelting('craftoria:akite_ingot', 'craftoria:raw_akite');
  }
});
