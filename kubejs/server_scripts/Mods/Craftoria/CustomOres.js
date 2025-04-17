LootJS.lootTables(event => {
  for (const [entry, ore] of Object.entries(global.customOres)) {
    let { stone, deepslate, nether, end } = ore.worldGen;
    if (!stone && !deepslate && !nether && !end) continue; // Skip if no world generation types are enabled

    let types = [];
    for (const [key, value] of Object.entries(ore.worldGen)) {
      if (key === 'harvestLevel') continue; // Skip harvest level
      if (value) types.push(key);
    }

    for (const type of types) {
      let name = type === 'stone' ? entry : `${type}_${entry}`;
      let block = `${name}_ore`;
      let raw = `raw_${entry}`;

      if (block) {
        createLootTable(name, block, raw);
      }
    }
  }

  /**
   * Creates a loot table for the specified ore type.
   * @param {string} name
   * @param {string} block
   * @param {string} raw
   */
  function createLootTable(name, block, raw) {
    event
      .getBlockTable(`craftoria:${name}_ore`)
      .clear()
      .firstPool(pool => {
        pool.rolls(1);
        pool.addEntry(LootEntry.of(`craftoria:${block}`).matchTool(ItemFilter.hasEnchantment('minecraft:silk_touch')));
        pool.addEntry(LootEntry.of(`craftoria:${raw}`).applyOreBonus('minecraft:fortune').survivesExplosion());
      });
  }
});
