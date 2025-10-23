var roi = ee.FeatureCollection("projects/ee-riyadesdm7/assets/Chittagong_Metropolitan_Area_CMA");

var dataset = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterDate('2023-02-15', '2023-03-31')
    .filterMetadata('CLOUD_COVER', 'less_than', 1);
    
// Applies scaling factors.
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

dataset = dataset.map(applyScaleFactors).median();

var visualization = {
  bands: ['SR_B5', 'SR_B4', 'SR_B2'],
  min: 0.0,
  max: 0.3,
};

Map.centerObject(roi, 10);
// Map.addLayer(dataset.clip(roi), visualization, 'Landsat_2020');

var addIndices = function(image) {
  var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename(['ndvi']);
  var ndbi = image.normalizedDifference(['SR_B6', 'SR_B5']).rename(['ndbi']);
  var mndwi = image.normalizedDifference(['SR_B3', 'SR_B6']).rename(['mndwi']); 
  var bsi = image.expression(
      '(( X + Y ) - (A + B)) /(( X + Y ) + (A + B)) ', {
        'X': image.select('SR_B6'), //swir1
        'Y': image.select('SR_B4'),  //red
        'A': image.select('SR_B5'), // nir
        'B': image.select('SR_B2'), // blue
  }).rename('bsi');
  return image.addBands(ndvi).addBands(ndbi).addBands(mndwi).addBands(bsi);
};

var segments = addIndices(dataset);


var trainingFeatures = built_up.merge(barren).merge(agriculture).merge(forest).merge(water);
print(trainingFeatures);

// select bands
var predictionBands = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'ndvi', 'ndbi', 'mndwi', 'bsi'];

// Add a random column and split the GCPs into training and validation set
var trainingFeatures = trainingFeatures.randomColumn();

// This being a simpler classification, we take 60% points
// for validation. Normal recommended ratio is
// 70% training, 30% validation
var trainingGcp = trainingFeatures.filter(ee.Filter.lt('random', 0.7));
var validationGcp = trainingFeatures.filter(ee.Filter.gte('random', 0.7));

// sample the input imagery to get a FeatureCollection of training data
var training = segments.select(predictionBands).sampleRegions({
  collection: trainingGcp,
  properties: ['landcover'],
  scale: 30
});

/////////////// Random Forest Classifier /////////////////////

// Train RF classifier.

var classifier = ee.Classifier.smileRandomForest(100).train({
  features: training,
  classProperty: 'landcover',
  inputProperties: predictionBands
});

// classify the input imagery
var classified = segments.select(predictionBands).classify(classifier);

// define color palette
var palette = ['#d60404', '#ffffff', '#65c67d', '#129320', '#000000'];

// Display the classified result
Map.addLayer(classified.clip(roi), {min: 0, max:4, palette: palette}, 'LULC_2020');

//************************************************************************** 
// Accuracy Assessment
//************************************************************************** 

// Use classification map to assess accuracy using the validation fraction
// of the overall training set created above.

var test = classified.sampleRegions({
  collection: validationGcp,
  properties: ['landcover'],
  scale: 30
});

var testConfusionMatrix = test.errorMatrix('landcover', 'classification')

// Printing of confusion matrix may time out. Alternatively, you can export it as CSV
print('Confusion Matrix', testConfusionMatrix);
print('Test Accuracy', testConfusionMatrix.accuracy());
print('Producers Accuracy', testConfusionMatrix.producersAccuracy());
print('Consumers Accuracy', testConfusionMatrix.consumersAccuracy());
print('Kappa', testConfusionMatrix.kappa());

////////////////Area Calculation////////////////////////

// Calling .geometry() on a feature collection gives the
// dissolved geometry of all features in the collection

// .area() function calculates the area in square meters
var cityArea = roi.geometry().area();

// We can cast the result to a ee.Number() and calculate the
// area in square kilometers
var cityAreaSqKm = ee.Number(cityArea).divide(1e6).round();
print('Total Area', cityAreaSqKm);

// Forest Area Calculation for Images
var Forest = classified.eq(3);
Map.addLayer(Forest.clip(roi), {min:0, max:1, palette: ['white', 'green']}, 'Forest Area');
var areaImage = Forest.multiply(ee.Image.pixelArea());

var area = areaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi.geometry(),
  scale: 30,
  maxPixels: 1e10
});
var ForestAreaSqKm = ee.Number(area.get('classification')).divide(1e6).round();
print('Forset', ForestAreaSqKm);


// Urban Area Calculation for Images
var Urban = classified.eq(0);
Map.addLayer(Urban.clip(roi), {min:0, max:1, palette: ['white', 'green']}, 'Urban Area');
var areaImage = Urban.multiply(ee.Image.pixelArea());

var area = areaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi.geometry(),
  scale: 30,
  maxPixels: 1e10
});
var UrbanAreaSqKm = ee.Number(area.get('classification')).divide(1e6).round();
print('Urban', UrbanAreaSqKm);

// Water Body Calculation for Images
var Water = classified.eq(4);
Map.addLayer(Water.clip(roi), {min:0, max:1, palette: ['white', 'green']}, 'Water Body');
var areaImage = Water.multiply(ee.Image.pixelArea());

var area = areaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi.geometry(),
  scale: 30,
  maxPixels: 1e10
});
var WaterAreaSqKm = ee.Number(area.get('classification')).divide(1e6).round();
print('Water', WaterAreaSqKm);

// Agriculture Land Calculation for Images
var Agriculture = classified.eq(2);
Map.addLayer(Agriculture.clip(roi), {min:0, max:1, palette: ['white', 'green']}, 'Agriculture Land');
var areaImage = Agriculture.multiply(ee.Image.pixelArea());

var area = areaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi.geometry(),
  scale: 30,
  maxPixels: 1e10
});
var AgricultureAreaSqKm = ee.Number(area.get('classification')).divide(1e6).round();
print('Agriculture', AgricultureAreaSqKm);

// Barren Land Calculation for Images
var Barren = classified.eq(1);
Map.addLayer(Barren.clip(roi), {min:0, max:1, palette: ['white', 'green']}, 'Barren Land');
var areaImage = Barren.multiply(ee.Image.pixelArea());

var area = areaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi.geometry(),
  scale: 30,
  maxPixels: 1e10
});
var BarrenAreaSqKm = ee.Number(area.get('classification')).divide(1e6).round();
print('Barren', BarrenAreaSqKm);