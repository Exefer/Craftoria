LootJS.lootTables(event => {
  for (const [entry, ore] of Object.entries(global.customOres)) {
    let oreVariants = {
      stone: `${entry}_ore`,
      deepslate: `deepslate_${entry}_ore`,
      nether: `nether_${entry}_ore`,
      end: `end_${entry}_ore`,
    };

    for (const [variant, oreId] of Object.entries(oreVariants)) {
      if (!ore.worldGen[variant]) continue; // Skip if the variant is not present
      createLootTable(oreId, `raw_${entry}`);
    }
  }

  /**
   * Creates a loot table for the specified ore type.
   * @param {string} oreId
   * @param {string} raw
   */
  function createLootTable(oreId, raw) {
    event
      .getBlockTable(`craftoria:${oreId}`)
      .clear()
      .firstPool(pool => {
        pool.rolls(1);
        pool.addEntry(LootEntry.of(`craftoria:${oreId}`).matchTool(ItemFilter.hasEnchantment('minecraft:silk_touch')));
        pool.addEntry(
          LootEntry.of(`craftoria:${raw}`)
            .applyOreBonus('minecraft:fortune')
            .matchTool(ItemFilter.hasEnchantment('minecraft:silk_touch').negate())
            .survivesExplosion()
        );
      });
  }
});
