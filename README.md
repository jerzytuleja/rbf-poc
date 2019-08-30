# rbf-poc

npm run start

generate pbf files with usage of command:

docker run -it --rm -v c:/projects/meteo/roadmaster/map/rbf:/data igac/tippecanoe:1.34.3 tippecanoe -e /data/output --force -l geojsonLayer -zg --preserve-input-order /data/merged.json