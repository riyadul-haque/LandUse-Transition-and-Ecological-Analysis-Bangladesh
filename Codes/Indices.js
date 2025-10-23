var roi = ee.FeatureCollection("projects/ee-riyadesdm7/assets/Chittagong_Metropolitan_Area_CMA");

// Applies scaling factors.
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBand = image.select('ST_B6').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBand, null, true);
}

// For 2003

var landsat2003 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
    .filterDate('2003-04-01', '2003-11-30')
    .filterMetadata('CLOUD_COVER', 'less_than', 10)
    .map(applyScaleFactors)
    .median()
    .clip(roi);

print(landsat2003);

var visualization = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0.0,
  max: 0.3,
};

Map.centerObject(roi, 10);
// Map.addLayer(landsat2003, visualization, 'Landsat2003');

// ---------------------------------------------NDBSI_2003--------------------------------------------------------------

var IBI = landsat2003.expression(
  '(2*SWIR1/(SWIR1+NIR)-(NIR/(NIR+RED)+GREEN/(GREEN+SWIR1)))/(2*SWIR1/(SWIR1+NIR)+(NIR/(NIR+RED)+GREEN/(GREEN+SWIR1)))'
  ,
  {
    'SWIR1': landsat2003.select("SR_B5"),
    'NIR': landsat2003.select("SR_B4"),
    'RED': landsat2003.select("SR_B3"),
    'GREEN': landsat2003.select("SR_B2"),
  }
).rename('IBI');

 var SI = landsat2003.expression(
  '((SWIR1+RED)-(BLUE+NIR))/((SWIR1+RED)+(BLUE+NIR))'
  ,
  {
    'SWIR1': landsat2003.select("SR_B5"),
    'NIR': landsat2003.select("SR_B4"),
    'RED': landsat2003.select("SR_B3"),
    'BLUE': landsat2003.select("SR_B1"),
  }
).rename('SI');

var NDBSI2003 = landsat2003.expression(
  '(IBI+SI)/2'
  ,
  {
    'IBI': IBI.select("IBI"),
    'SI': SI.select("SI")
  }
).rename('NDBSI');


// Print the minimum and maximum NDBSI values in the roi
var minMax = NDBSI2003.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e100
});

print('Min & Max NDBSI: ', minMax);

var ndbsiVis = {min: -0.6953695639715968, max: 0.47123159984491914, palette: ['white', 'green']};
Map.addLayer(NDBSI2003,ndbsiVis,"NDBSI2003");

// -----------------------------------------------NDVI_2003--------------------------------------------------------------

var NDVI2003 = landsat2003.normalizedDifference(['SR_B4', 'SR_B3']);

// Print the minimum and maximum NDVI values in the roi
var minMax = NDVI2003.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e100
});

print('Min & Max NDVI: ', minMax);

var ndbsiVis = {min: -0.3678955057145314, max: 0.857380939635637, palette: ['white', 'green']};

Map.addLayer(NDVI2003,ndbsiVis,"NDVI2003");


// ---------------------------------------------WET2003------------------------------------------------------------

var WET2003 = landsat2003.expression(
  '((0.0315 * Blue) + (0.2021 * Green) + (0.3102 * Red) + (0.1594 * NIR) - (0.6806 * SWIR1) - (0.6109 * SWIR2))'
  ,
  {
  'Blue': landsat2003.select("SR_B1"),
  'Green': landsat2003.select("SR_B2"),
  'Red': landsat2003.select("SR_B3"),
  'NIR': landsat2003.select("SR_B4"),
  'SWIR1': landsat2003.select("SR_B5"),
  'SWIR2': landsat2003.select("SR_B7"),
  
  }
).rename('WET2003');
  
// Print the minimum and maximum WET values in the roi
var minMax = WET2003.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e100
});

print('Min & Max WET: ', minMax);

var ndbsiVis = {min: -1.4539222705000001, max: 0.1207399395, palette: ['white', 'green']};

Map.addLayer(WET2003,ndbsiVis,"WET2003");

// ---------------------------------------------MNDWI------------------------------------------------------------

var MNDWI2003 = landsat2003.normalizedDifference(['SR_B2', 'SR_B5']);

// Print the minimum and maximum NDVI values in the roi
var minMax = MNDWI2003.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e100
});

print('Min & Max MNDWI: ', minMax);

var ndbsiVis = {min: -0.8292407074808961, max: 0.9782520179157386, palette: ['white', 'green']};

Map.addLayer(MNDWI2003,ndbsiVis,"MNDWI2003");

Export.image.toDrive({
  image: MNDWI2003,
  description: 'MNDWI2003',
  folder: "Ecological_Quality_CMA",
  scale: 30,
  region: roi,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true
  }
});
