function QuadLoader () {
    this.zoomOffset = 0;

    this.loadedTiles = {};
}

QuadLoader.prototype = {
    addToMap: function (map) {
        this.map = map;
        map.events.add('boundschange', this.query, this);
        this.query();


    },

    removeFromMap: function () {

    },

    codeToRegion: function (bincode, length) {
        var bounds = [
            [0, 0],
            [256, 256]
        ];

        for (var i = 0, maxZoom = 16; i < length; i++, maxZoom--) {
            //центр ноды
            var center = [
                    (bounds[0][0] + bounds[1][0]) * 0.5,
                    (bounds[0][1] + bounds[1][1]) * 0.5
                ],
                zcode = 3 & (bincode >> (2 * maxZoom)),
                xdel = zcode & 1,
                ydel = zcode & 2;
            //меняем границы, переходя в ребенка
            if (xdel) bounds[0][0] = center[0];
            else      bounds[1][0] = center[0];

            if (ydel) bounds[0][1] = center[1];
            else      bounds[1][1] = center[1];
        }
        return bounds;
    },

    getPixelCode: function (point, zoom) {
        var bounds = [
                [0, 0],
                [256, 256]
            ],
            code = '',
            binCode = 0;

        zoom = Math.min(16, zoom);

        for (var i = 0, maxZoom = 16; i < zoom; i++, maxZoom--) {
            //центр ноды
            var center = [
                    (bounds[0][0] + bounds[1][0]) * 0.5,
                    (bounds[0][1] + bounds[1][1]) * 0.5
                ],
                xdel = point[0] > center[0] ? 1 : 0,
                ydel = point[1] > center[1] ? 2 : 0;
            //меняем границы, переходя в ребенка
            if (xdel) bounds[0][0] = center[0];
            else      bounds[1][0] = center[0];

            if (ydel) bounds[0][1] = center[1];
            else      bounds[1][1] = center[1];

            var path = xdel + ydel;
            code += '' + path;
            binCode |= path << (2 * maxZoom);
        }
        return {
            name: code,
            bin: binCode,
            region: bounds
        }
    },

    query: function () {
        var tiles = this.buildTileList();
        for (var i = 0, l = tiles.length; i < l; ++i) {
            var name = tiles[i].name;
            //были ли этот квад уже загружен?
            if (!this.loadedTiles[name]) {
                var skip = false;
                //смотрим не был ли загружен данный квад "выше"
                for (var j = name.length - 1; j > 0; --j) {
                    if (this.loadedTiles[name.substr(0, j)]) {
                        //сущесвует нода верхнего уровня
                        //тут можно проверить что она содержит полный набор данных
                        //например обьектов меньше чем лимит отдачи с сервера
                        this.loadedTiles[name] = true;
                        //именно этот момент позволяет одной "полной" нодой верхнего уровня определить все подчиненные
                        skip=true;
                        break;
                    }
                }
                //смотрим не был ли определен данные квад "ниже"
                if (skip || (
                    this.loadedTiles[name + '0'] &&
                    this.loadedTiles[name + '1'] &&
                    this.loadedTiles[name + '2'] &&
                    this.loadedTiles[name + '3']
                    )) {
                    //все подчиненные ноды определены
                    //загрузка этой не принесет ничего нового
                    this.loadedTiles[name] = true;
                    continue;
                }
                //требуется загрузка квада
                this.loadedTiles[name] = tiles[i];
                this.renderQuad(tiles[i]);
            }
        }
    },

    renderQuad: function (tile) {
        window.console && console.log('render ', tile.name);
        //демонстрационная функция
        //отображает квадрат в зоне загрузки
        var clientSpace = this.codeToRegion(tile.bin, tile.name.length);

        var rect = [
                this.map.options.get('projection').fromGlobalPixels(clientSpace[0], 0),
                this.map.options.get('projection').fromGlobalPixels(clientSpace[1], 0)
            ],
            tileRect = new ymaps.Rectangle(rect, {
                hintContent: tile.name + " | " + tile.name.length
            }, {
                borderRadius: 10,
                fillOpacity: 0.2,
                interactivityModel: 'default#transparent'
            });

        this.map.geoObjects.add(tileRect);
    },

    buildTileList: function () {
        var map = this.map,
            center = map.getGlobalPixelCenter(),
            size = map.container.getSize(),
            mapZoom = map.getZoom(),
            zoomFactor = Math.pow(2, -mapZoom),
            pixelCenter = [center[0] * zoomFactor, center[1] * zoomFactor],
            pixelSize = [size[0] * zoomFactor, size[1] * zoomFactor],
            tileSize = 256 * zoomFactor,
        //нам нужны пиксельные границы в пространстве нулевого зума расширенная до углов тайлов
            pixelBounds = [
                [Math.max(0,pixelCenter[0] - pixelSize[0] * .5), Math.max(pixelCenter[1] - pixelSize[1] * .5)],
                [Math.min(256,pixelCenter[0] + pixelSize[0] * .5), Math.min(256,pixelCenter[1] + pixelSize[1] * .5)],
            ],
            pixelStart = pixelBounds[0],
            pixelEnd = pixelBounds[1],
            quadZoom = mapZoom - this.zoomOffset,
            quadFactor = Math.pow(2, -quadZoom),
            tiles = [],
            xfill = 1;


        //набиваем квады, пока они не выходях за пределы экрана
        for (var x = 0; xfill; x += tileSize) {
            for (var y = 0; ; y += tileSize) {
                var code = this.getPixelCode([0 + pixelStart[0] + x, 0 + pixelStart[1] + y], quadZoom);
                tiles.push(code);
                if (code.region[1][1] >= pixelEnd[1]) {
                    if (code.region[1][0] >= pixelEnd[0]) {
                        xfill = 0;
                        break;
                    }
                    break;
                }

            }
        }

        return tiles;

    }

};