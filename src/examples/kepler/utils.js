import get from 'lodash.get'

import { processGeojson } from 'kepler.gl/processors'

const MAX_LATITUDE = 90
const MIN_LATITUDE = -90
const MAX_LONGITUDE = 180
const MIN_LONGITUDE = -180

export const GBFS_STATION_ID_PREFIX = 'GBFS_Stations_'

export function getLayerBounds(layers) {
  // Taken from non-importable utils, see: https://github.com/keplergl/kepler.gl/blob/master/src/utils/data-utils.js#L54
  const availableLayerBounds = layers.reduce((res, l) => {
    if (l.meta && l.meta.bounds) {
      res.push(l.meta.bounds)
    }
    return res
  }, [])
  const newBounds = availableLayerBounds.reduce(
    (res, b) => {
      return [
        Math.min(res[0], b[0]),
        Math.min(res[1], b[1]),
        Math.max(res[2], b[2]),
        Math.max(res[3], b[3]),
      ]
    },
    [MAX_LONGITUDE, MAX_LATITUDE, MIN_LONGITUDE, MIN_LATITUDE],
  )
  const lonDiff = newBounds[0] - newBounds[2]
  const latDiff = newBounds[1] - newBounds[3]
  // NOTE: Kepler zooms in too much so we need to increase the bounds' extent
  // We need a bit more space on longitude max side so that filters can fit on the bottom of viewport
  const extendedBounds = [
    newBounds[0] + lonDiff * 0.6,
    newBounds[1] + latDiff * 1,
    newBounds[2] - lonDiff * 0.6,
    newBounds[3] - latDiff * 0.6,
  ]
  console.log('Recentering viewport around', extendedBounds)
  return extendedBounds
}

export function doesLinestringHaveTimes(feature) {
  const propertyKeys = Object.keys(feature.properties)
  return (
    propertyKeys.some((item) => item.includes('start')) &&
    (propertyKeys.some((item) => item.includes('duration')) ||
      propertyKeys.some((item) => item.includes('end')))
  )
}

export function enrichLinestringFeatureToTrip(feature) {
  let coordinates
  const propertyKeys = Object.keys(feature.properties)
  if (doesLinestringHaveTimes(feature)) {
    try {
      const startDateProperty = propertyKeys.find((item) => item.includes('start'))
      const startTimestamp = Date.parse(feature.properties[startDateProperty])
      const durationProperty = propertyKeys.find((item) => item.includes('duration'))
      const duration = feature.properties[durationProperty]
      const endDateProperty = propertyKeys.find((item) => item.includes('end'))
      const endTimestamp = Date.parse(feature.properties[endDateProperty])
      const tripDuration = duration ? duration * 1000 : endTimestamp - startTimestamp
      coordinates = feature.geometry.coordinates.map((item, index, array) => [
        ...item,
        0,
        Math.round(startTimestamp + (tripDuration / (array.length - 1)) * index),
      ])
    } catch (e) {
      // Well, we tried...
    }
  }
  // We need to create a new object here as mutating would change the original LineString
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: {
      ...feature.properties,
    },
  }
}

// Taking the `datasets` Array and mutating them in a function isn't great, but we're processing
// feeds in parallel, some items are inserted at the beginning, parsing performance matters and with
// index feeds we need to go recursive...
async function parseGbfsFeed(datasets, url) {
  const response = await fetch(url, { cors: true })
  const gbfsJson = await response.json()
  console.log(`Got GBFS data for ${url}:`, gbfsJson)
  if (get(gbfsJson, 'data.geofencing_zones.features.length', 0) > 0) {
    datasets.push({
      info: {
        label: `Geofencing zones ${url}`,
        id: `GBFS_Geofencing_zones_${murmur_hash(url)}`,
      },
      data: processGeojson({
        type: 'FeatureCollection',
        features: gbfsJson.data.geofencing_zones.features.map((zone) => {
          const { geometry, properties } = zone
          return {
            type: 'Feature',
            geometry,
            properties: {
              id: properties.name,
              fillColor: [0, 0, 0, 0],
              lineColor: [200, 0, 0],
            },
          }
        }),
      }),
    })
  } else if (get(gbfsJson, 'data.regions.length', 0) > 0) {
    datasets.push({
      info: {
        label: `Service areas ${url}`,
        id: `GBFS_Service_areas_${murmur_hash(url)}`,
      },
      data: processGeojson({
        type: 'FeatureCollection',
        features: gbfsJson.data.regions.map((region) => {
          const { region_id, geom, ...properties } = region
          return {
            type: 'Feature',
            geometry: geom,
            properties: {
              ...properties,
              id: region_id,
              fillColor: [0, 0, 0, 0],
              lineColor: [200, 0, 0],
            },
          }
        }),
      }),
    })
  } else if (get(gbfsJson, 'data.stations.length', 0) > 0) {
    datasets.splice(0, 0, {
      info: {
        label: `Stations ${url}`,
        id: `${GBFS_STATION_ID_PREFIX}${murmur_hash(url)}`,
      },
      data: processGeojson({
        type: 'FeatureCollection',
        features: gbfsJson.data.stations.map((station) => {
          const { station_id, lat, lon, ...properties } = station
          return {
            type: 'Feature',
            // geometry: {
            //   type: "Polygon",
            //   coordinates: [h3ToGeoBoundary(geoToH3(lat, lon, 11), true)]
            // },
            geometry: {
              type: 'Point',
              coordinates: [lon, lat],
            },
            properties: {
              ...properties,
              id: station_id,
              fillColor: [0, 0, 0, 0],
              radius: 30,
              lineColor: [200, 0, 0],
              lineWidth: 1,
            },
          }
        }),
      }),
    })
  } else if (get(gbfsJson, 'data.en.feeds.length', 0) > 0) {
    return Promise.all(
      gbfsJson.data.en.feeds.map(async (feed) => {
        if (feed.hasOwnProperty('url')) {
          return parseGbfsFeed(datasets, feed.url)
        }
      }),
    )
  } else {
    console.warn(
      'Only "gbfs" index, "geofencing_zones", "regions" and "stations" GBFS feeds are supported, ' +
        'but got: ',
      gbfsJson,
    )
  }
}

export async function loadGbfsFeedsAsKeplerDatasets(urls) {
  if (!Array.isArray(urls)) {
    console.error('Invalid GBFS feed URLs (should be an Array of Strings):', urls)
    return null
  }

  const datasets = []
  // Using Promise.all to make requests happen in parallel
  await Promise.all(
    urls.map(async (url) => {
      try {
        await parseGbfsFeed(datasets, url)
      } catch (e) {
        console.error('Could not load GBFS feed, error: ', e)
        return null
      }
    }),
  )

  console.log('GBFS datasets', datasets)

  return datasets
}

// This custom merger enables us to merge arrays as object properties
export function mergeArrayProperties(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    // Update the existing array with push() instead of creating a new one with concat() as it's much faster
    Array.prototype.push.apply(objValue, srcValue)
    return objValue
  }
}

// Murmur-like hashing script, thanks https://stackoverflow.com/a/52171480/21217
export function murmur_hash(str, seed = 7) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
