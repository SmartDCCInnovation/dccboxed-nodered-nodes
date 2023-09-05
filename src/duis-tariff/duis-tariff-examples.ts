/*
 * Created on Mon Aug 21 2023
 *
 * Copyright (c) 2023 Smart DCC Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import type { Tariff } from '@smartdcc/duis-templates'

export const examples: Record<string, Tariff> = {
  TOU: {
    seasons: [
      {
        name: 'winter',
        year: 2014,
        month: 10,
        dayOfMonth: 27,
        weekProfile: 1,
      },
      {
        name: 'summer',
        year: 2015,
        month: 3,
        dayOfMonth: 29,
        weekProfile: 2,
      },
    ],
    weekProfiles: [
      [1, 1, 1, 1, 1, 3, 3],
      [2, 2, 2, 2, 2, 3, 3],
    ],
    dayProfiles: [
      [
        {
          mode: 'tou',
          startTime: 0,
          action: 2,
        },
        {
          mode: 'tou',
          startTime: 7 * 60 * 60,
          action: 3,
        },
      ],
      [
        {
          mode: 'tou',
          startTime: 0,
          action: 3,
        },
        {
          mode: 'tou',
          startTime: 23 * 60 * 60,
          action: 2,
        },
      ],
      [
        {
          mode: 'tou',
          startTime: 0,
          action: 1,
        },
      ],
    ],
    specialDays: [
      { year: 2015, month: 5, dayOfMonth: 1, dayProfile: 2 },
      { month: 12, dayOfMonth: 25, dayProfile: 3 },
    ],
    tous: [2121, 3127, 4744],
    blocks: [
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
    ],
    pricing: {
      priceScale: -5,
      standingCharge: 20000,
      standingChargeScale: -5,
    },
  },
  Block: {
    seasons: [
      {
        name: 'all',
        year: 2015,
        month: 1,
        dayOfMonth: 1,
        weekProfile: 1,
      },
    ],
    weekProfiles: [[1, 1, 1, 1, 1, 1, 1]],
    dayProfiles: [
      [
        {
          mode: 'block',
          startTime: 0,
          action: 1,
        },
      ],
    ],
    specialDays: [],
    tous: [],
    blocks: [
      {
        prices: [1361, 2289, 5566, 0],
        thresholds: [10000, 20000, 4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
      {
        prices: [0, 0],
        thresholds: [4294967295],
      },
    ],
    pricing: {
      priceScale: -5,
      standingCharge: 20000,
      standingChargeScale: -5,
    },
  },
}
