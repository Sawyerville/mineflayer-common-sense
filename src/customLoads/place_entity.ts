import assert = require("assert");
import { Bot } from "mineflayer";
import {Vec3} from "vec3";
import type {Block} from "prismarine-block";
import type {Entity} from "prismarine-entity";

export function inject (bot: Bot) {
  const Item = require('prismarine-item')(bot.registry)

  /**
   *
   * @param {import('prismarine-block').Block} referenceBlock
   * @param {import('vec3').Vec3} faceVector
   * @param {{forceLook?: boolean | 'ignore', offhand?: boolean, swingArm?: 'right' | 'left', showHand?: boolean}} options
   */
  async function placeEntityWithOptions (referenceBlock: Block, faceVector: Vec3, options: {forceLook?: boolean | 'ignore', offhand?: boolean, swingArm?: 'right' | 'left', showHand?: boolean}) {
    const item = bot.util.inv.getHandWithItem(options.offhand)
    if (!item) throw new Error('must be holding an item to place an entity')
  
    const type = item.name // used for assert
      .replace(/.+_boat/, 'boat')
      .replace(/.+_spawn_egg/, 'spawn_egg')
    assert(['end_crystal', 'boat', 'spawn_egg', 'armor_stand'].includes(type), 'Unimplemented')
  
    let name = item.name // used for finding entity after spawn
      .replace(/.+_boat/, 'boat')
  
    if (name.endsWith('spawn_egg')) {
      name = item.spawnEggMobName
    }
  
    if (type === 'spawn_egg') {
      options.showHand = false
    }
    if (!options.swingArm) options.swingArm = options.offhand ? 'left' : 'right'

    const pos = await (bot as any)._genericPlace(referenceBlock, faceVector, options)
    if (type === 'boat') {
        console.log(bot.supportFeature('useItemWithOwnPacket'), options.offhand)
      if (bot.supportFeature('useItemWithOwnPacket')) {
        bot._client.write('use_item', {
          hand: options.offhand ? 1 : 0
        })
      } else {
        bot._client.write('block_place', {
          location: { x: -1, y: -1, z: -1 },
          direction: -1,
          heldItem: Item.toNotch(item),
          cursorX: 0,
          cursorY: 0,
          cursorZ: 0
        })
      }
    }

    const dest = pos.plus(faceVector)
    const entity = await waitForEntitySpawn(name, dest)
    bot.emit('entityPlaced' as any, entity)
    return entity
  }

  async function placeEntity (referenceBlock: Block, faceVector: Vec3) {
    return await placeEntityWithOptions(referenceBlock, faceVector, {})
  }

  function waitForEntitySpawn (name: string, placePosition: Vec3) {
    const maxDistance = name === 'bat' ? 4 : name === 'boat' ? 3 : 2
    let mobName = name
    if (name === 'end_crystal') {
      if (bot.supportFeature('enderCrystalNameEndsInErNoCaps')) {
        mobName = 'ender_crystal'
      } else if (bot.supportFeature('entityNameLowerCaseNoUnderscore')) {
        mobName = 'endercrystal'
      } else if (bot.supportFeature('enderCrystalNameNoCapsWithUnderscore')) {
        mobName = 'end_crystal'
      } else {
        mobName = 'EnderCrystal'
      }
    } else if (name === 'boat') {
      mobName = bot.supportFeature('entityNameUpperCaseNoUnderscore') ? 'Boat' : 'boat'
    } else if (name === 'armor_stand') {
      if (bot.supportFeature('entityNameUpperCaseNoUnderscore')) {
        mobName = 'ArmorStand'
      } else if (bot.supportFeature('entityNameLowerCaseNoUnderscore')) {
        mobName = 'armorstand'
      } else {
        mobName = 'armor_stand'
      }
    }

    return new Promise((resolve, reject) => {
      function listener (entity: Entity) {
        const dist = entity.position.distanceTo(placePosition)
        if (entity.name === mobName && dist < maxDistance) {
          resolve(entity)
        }
        bot.off('entitySpawn', listener)
      }

      setTimeout(() => {
        bot.off('entitySpawn', listener)
        reject(new Error('Failed to place entity'))
      }, 5000) // reject after 5s

      bot.on('entitySpawn', listener)
    })
  }

  (bot as any).placeEntity = placeEntity;
  (bot as any)._placeEntityWithOptions = placeEntityWithOptions;
}
