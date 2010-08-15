function CanvasZoom( canvas, tilesFolder, imageWidth, imageHeight )
{
	var t = this; // make "this" accessible when out of "this" scope and minify
	
	var _tileOverlap = 1; // assumed
	var _tileSize = 256; // assumed
	
	var _debug = false;
	
	var _zoomLevelMin = 0;
	var _zoomLevelMax = 0;
	var _zoomLevelFull = -1; // For painting a background image for all missing tiles. Needs improvement though.
	var _zoomLevel = -1;
	
	var _mouseX = 0;
	var _mouseY = 0;
	var _mouseDownX = 0;
	var _mouseDownY = 0;
	var _mousePosX = 0;
	var _mousePosY = 0;
	var _mouseMoveX = 0;
	var _mouseMoveY = 0;

	var _mouseIsDown = false;
	var _mouseLeftWhileDown = false;

	var _offsetX = 0;
	var _offsetY = 0;

	var _aGetWidth = 'w';
	var _aGetHeight = 'h';
	var _aGetTile = 't';
	var _aGetWaiting = 'wt';
	
	var _tileZoomArray = null;
	var _imageLoader = null;

	var _ctx = null;

	var getTileFile = function( zoom, column, row ) {
		return "" + tilesFolder + "/" + zoom + "/" + column + "_" + row + ".jpg";
	}

	var setup = function()
	{
		_zoomLevelMax = Math.ceil( Math.log( Math.max( imageWidth, imageHeight ))/Math.LN2 );
		_tileZoomArray = new Array( _zoomLevelMax );

		var reducingWidth = imageWidth;
		var reducingHeight = imageHeight;
		var zoomLevelStart = -1;

		for( var iZoom = _zoomLevelMax;  iZoom >= _zoomLevelMin; iZoom-- )
		{
			var columns = Math.ceil( reducingWidth / _tileSize );
    			var rows = Math.ceil( reducingHeight / _tileSize );

			if( _zoomLevelFull == -1 && 
					reducingWidth <= _tileSize && reducingHeight <= _tileSize )
			{
				// Largest full image inside single tile.
				_zoomLevelFull = iZoom;
			}
			
			if( zoomLevelStart == -1 && 
					reducingWidth <= canvas.width && reducingHeight <= canvas.height )
			{
				// Largest full image inside single tile.
				zoomLevelStart = iZoom;
			}

			// Create array for tiles
			_tileZoomArray[iZoom] = new Array(columns);
			for( var iColumn = 0; iColumn < columns; iColumn++ )
				_tileZoomArray[iZoom][iColumn] = new Array(rows);
			
			// Set defaults
			_tileZoomArray[iZoom][_aGetWidth] = reducingWidth;
    			_tileZoomArray[iZoom][_aGetHeight] = reducingHeight;
			for( var iColumn = 0; iColumn < columns; iColumn++ )
			{
				for( var iRow = 0; iRow < rows; iRow++ )
				{
					_tileZoomArray[iZoom][iColumn][iRow] = new Array();
					
					_tileZoomArray[iZoom][iColumn][iRow][_aGetTile] = null;
					_tileZoomArray[iZoom][iColumn][iRow][_aGetWaiting] = false;
				}
			}
			
			reducingWidth /= 2;
			reducingHeight /= 2;
		}
		
		_zoomLevel = zoomLevelStart;
		
		//
		// Initial tile load
		//
		var imageList = new Array();	
		var imageId = 0;
		
		var columns = _tileZoomArray[_zoomLevel].length;
 		var rows = _tileZoomArray[_zoomLevel][0].length;
 		
		for( var iColumn = 0; iColumn < columns; iColumn++ )
		{
			for( var iRow = 0; iRow < rows; iRow++ )
			{
				imageList.push( { "id" : imageId++, "file": getTileFile( _zoomLevel, iColumn, iRow  ) } );
			}
		}
		
		imageList.push( { "id" : imageId, "file": getTileFile( _zoomLevelFull, 0, 0  ) } );
		
		_imageLoader = new ImageLoader( {
			"images": imageList,
			"onAllLoaded":function() { initialTilesLoaded(); }
		} )
	}

	var initialTilesLoaded = function() {
		
		var tileZoomLevel = _tileZoomArray[_zoomLevel];
		
		var columns = tileZoomLevel.length;
 		var rows = tileZoomLevel[0].length;
 		
		var imageId = 0;
		for( var iColumn = 0; iColumn < columns; iColumn++ )
		{
			for( var iRow = 0; iRow < rows; iRow++ )
			{
				tileZoomLevel[iColumn][iRow][_aGetTile] = _imageLoader.getImageById( imageId++ );
			}
		}
		
		_tileZoomArray[_zoomLevelFull][0][0][_aGetTile] = _imageLoader.getImageById( imageId );
		
		//
		// Centre image
		//
		_offsetX = (canvas.width - tileZoomLevel[_aGetWidth]) / 2;
		_offsetY = (canvas.height - tileZoomLevel[_aGetHeight]) / 2;
		
		// 
		// Add mouse listener events
		//
		canvas.addEventListener('mousemove', function (e) { mouseMove( getEvent(e) ); }, true);
		canvas.addEventListener('mousedown', function (e) { mouseDown( getEvent(e) ); }, true);
		canvas.addEventListener('mouseup', function (e) { mouseUp( getEvent(e) ); }, true);
		
		canvas.addEventListener('mouseout', function (e) { mouseOut( getEvent(e) ); }, true);
		canvas.addEventListener('mouseover', function (e) { mouseOver( getEvent(e) ); }, true);
		canvas.addEventListener('DOMMouseScroll', function (e) { mouseWheel( getEvent(e) ); }, true);
		canvas.addEventListener('mousewheel', function (e) { mouseWheel( getEvent(e) ); }, true);
		
		// Keep track even if mouse is outside of canvas while dragging image
		window.addEventListener('mouseup', function (e) { mouseUpWindow( getEvent(e) ); }, false);
		window.addEventListener('mousemove', function (e) { mouseMoveWindow( getEvent(e) ); }, false);
		
		_ctx = canvas.getContext('2d');
		
		paint();
	};

	// Helper function
	var getEvent = function( event )
	{
		if( !event ) // IE
			event = window.event;
		
		return event;
	}
	
	var mouseDown = function( event ) {
		_mouseIsDown = true;
		_mouseLeftWhileDown = false;
		
		_mouseDownX = mousePosX(event);
		_mouseDownY = mousePosY(event); 
		
		_mouseMoveX = _mouseDownX;
		_mouseMoveY = _mouseDownY;
	}
	
	var mouseUp = function( event ) {
		_mouseIsDown = false;
		_mouseLeftWhileDown = false;
		
		_mouseX = mousePosX(event);
		_mouseY = mousePosY(event); 
		
		if( _mouseX == _mouseDownX &&
			 _mouseY == _mouseDownY )
		{
			// Didn't drag so assume a click.
			zoomIn();
		}
	}
	
	var mouseMove = function(event) {
		_mouseX = mousePosX(event);
		_mouseY = mousePosY(event); 

		if( _mouseIsDown )
		{
			var newOffsetX = _offsetX + (_mouseX - _mouseMoveX);
			var newOffsetY = _offsetY + (_mouseY - _mouseMoveY);
			
			calculateNeededTiles( _zoomLevel, newOffsetX, newOffsetY );
			
			_mouseMoveX = _mouseX;
			_mouseMoveY = _mouseY;
			
			_offsetX = newOffsetX;
			_offsetY = newOffsetY;
			
			paint();
		}
	}
	
	var mousePosX = function( event ) {
		// Get the mouse position relative to the canvas element.
		var x = 0;
		
		if (event.layerX || event.layerX == 0) { // Firefox
			x = event.layerX - canvas.offsetLeft;
		} else if (event.offsetX || event.offsetX == 0) { // Opera
			x = event.offsetX;
		}
		
		return x;
	}
	
	var mousePosY = function( event ) {
		var y = 0;
		
		if (event.layerY || event.layerY == 0) { // Firefox
			y = event.layerY - canvas.offsetTop;
		} else if (event.offsetY || event.offsetY == 0) { // Opera
			y = event.offsetY;
		}
		
		return y;
	}
	
	var mouseOut = function( event ) {
		if( _mouseIsDown )
		{
			_mouseLeftWhileDown = true;
		}
	}
	
	var mouseOver = function( event ) {
		// (Should be called mouseEnter IMO...)
		_mouseLeftWhileDown = false;
	}
	
	var mouseWheel = function( event ) {
		var delta = 0;
				 
		if (event.wheelDelta) { /* IE/Opera. */
			delta = event.wheelDelta/120;
			
			if (window.opera) /* Opera 9 */
				delta = -delta;
				         
		} else if (event.detail) { /* Mozilla */
			delta = event.detail/3;
		}

		if (delta)  {
			if (delta < 0)
				zoomIn();
			else
				zoomOut();
		}
				 
		if (event.preventDefault)
			event.preventDefault();
				    
		event.returnValue = false;
	}
	
	// If mouseUp occurs outside of canvas while moving, cancel movement.
	var mouseUpWindow = function( event ) {
		if( _mouseIsDown && _mouseLeftWhileDown )
		{
			mouseUp( event );
		}
	}
	
	// keep track of mouse outside of canvas so movement continues.
	var mouseMoveWindow = function(event) {
		if( _mouseIsDown && _mouseLeftWhileDown )
		{
			mouseMove(event);
		}
	}
	
	// Zoom in a single level
	var zoomIn = function () {
		zoom( _zoomLevel + 1 );
		paint();
	}
	
	// Zoom out a single level
	var zoomOut = function () {
		zoom( _zoomLevel - 1 );
		paint();
	}
	
	//Zoom in at the centre of the canvas
	this.zoomInCentre = function () {
		_mouseX = canvas.width / 2;
		_mouseY = canvas.height / 2;
		
		zoomIn();
	}
	
	//Zoom out at the centre of the canvas
	this.zoomOutCentre = function () {
		_mouseX = canvas.width / 2;
		_mouseY = canvas.height / 2;
		
		zoomOut();
	}
	
	// Change the zoom level and update.
	var zoom = function(zoomLevel) {
		if( zoomLevel >= _zoomLevelMin && zoomLevel <= _zoomLevelMax )
		{
			var newZoom = zoomLevel,
					currentZoom = _zoomLevel;
										
			//
			// Calculate new offset
			//
			var zoomX = _mouseX;
			var zoomY = _mouseY;
			
			// TODO: restrict zoom position to within (close?) area of image.
			
			var currentImageX = zoomX - _offsetX,
					currentImageY = zoomY - _offsetY;
			
			var scale = _tileZoomArray[newZoom][_aGetWidth] / _tileZoomArray[currentZoom][_aGetWidth];
			
			var newImageX = currentImageX * scale,
					newImageY = currentImageY * scale;
			
			var newOffsetX = _offsetX - (newImageX - currentImageX),
					newOffsetY = _offsetY - (newImageY - currentImageY);
					
			calculateNeededTiles( newZoom, newOffsetX, newOffsetY );
			
			
			_zoomLevel = newZoom;
			_offsetX = newOffsetX;
			_offsetY = newOffsetY;
		}
	}
	
	// Work out which of the tiles we need to download 
	var calculateNeededTiles = function( zoom, _offsetX, _offsetY ) {
		//
		// Calculate needed tiles
		//
		var tileZoomLevelArray = _tileZoomArray[zoom];
		var extend = _tileSize / 2;
		
		var canvasLeft = -_offsetX, 
				canvasTop = -_offsetY; 
		var canvasRight = canvasLeft + canvas.width,
				canvasBottom = canvasTop + canvas.height;
	
		var tileLeft = 0, tileRight = 0, tileTop = 0, tileBottom = 0;
		var tile = null;
	
		var zoomWidth = tileZoomLevelArray[_aGetWidth],
				zoomHeight = tileZoomLevelArray[_aGetHeight];
		
		var columns = tileZoomLevelArray.length,
			rows = tileZoomLevelArray[0].length;
		
		var tileList = new Array();
		for( var iColumn = 0; iColumn < columns; iColumn++ )
		{
			for( var iRow = 0; iRow < rows; iRow++ )
			{
				tile = tileZoomLevelArray[iColumn][iRow];
				
				if( tile[_aGetTile] == null && tile[_aGetWaiting] == false )
				{
					tileLeft = iColumn * _tileSize;
					tileRight = tileLeft + Math.min( _tileSize, zoomWidth - tileLeft );
					tileTop = iRow * _tileSize;
					tileBottom = tileTop + Math.min( _tileSize, zoomHeight - tileTop );
			
					if( !( tileLeft > canvasRight || tileRight < canvasLeft || tileTop > canvasBottom || tileBottom < canvasTop ) )
					{
						// request tile!
						tile[_aGetWaiting] = true;
						tileList.push( { "name" : zoom + "_" + iColumn + "_" + iRow, "file" : getTileFile( zoom, iColumn, iRow ) } );
					}
				}
			}
		}
		
		getTiles( tileList );
	}
	
	// Load the tiles we need with ImageLoader
	var getTiles = function( tileList ) {
		if( tileList.length > 0 )
		{
			_imageLoader = new ImageLoader( {
				"images": tileList,
				"onImageLoaded":function( name, tile ) { tileLoaded( name, tile ); }
			} )
		}
	}
	
	// Tile loaded, save it.
	var tileLoaded = function ( name, tile ) {
		var tileDetails = name.split("_");
		
		if( tileDetails.length == 3 )
		{
			var tileInfo = _tileZoomArray[tileDetails[0]][tileDetails[1]][tileDetails[2]];
			tileInfo[_aGetTile] = tile;
			tileInfo[_aGetWaiting] = false;
			
			paint();
		}
	}
	
	var paint = function () {
		var canvasWidth = canvas.width,
				canvasHeight = canvas.height;
	   
		//
		// Clear
		//
		_ctx.fillStyle = _ctx.strokeStyle = "#fff";
		_ctx.clearRect( 0, 0, canvasWidth, canvasHeight );
		
		//
		// Show images
		//
		var tileZoomLevelArray = _tileZoomArray[_zoomLevel];
		
		var columns = tileZoomLevelArray.length,
				rows = tileZoomLevelArray[0].length;
	
		var canvasLeft = -_offsetX,
				 canvasTop = -_offsetY;
		var canvasRight = canvasLeft + canvasWidth,
				canvasBottom = canvasTop + canvasHeight;
		
		var tileLeft = 0, tileRight = 0, tileTop = 0, tileBottom = 0; 
		var tileCount = 0;
		var tile = null;
		
		var zoomWidth = tileZoomLevelArray[_aGetWidth];
		var zoomHeight = tileZoomLevelArray[_aGetHeight];
		
		// TODO: This pastes a low resolution copy on the background (It's a bit of a hack and quite slow. A better solution is to find a nearer zoom)
		var fullTile = _tileZoomArray[_zoomLevelFull][0][0][_aGetTile];
		
		// TODO: Improve this by working out the start / end column and row using the image position instead of looping through them all (still pretty fast though!)
		for( var iColumn = 0; iColumn < columns; iColumn++ )
		{
			for( var iRow = 0; iRow < rows; iRow++ )
			{
				tileLeft = iColumn * _tileSize;
				tileRight = tileLeft + Math.min( _tileSize, zoomWidth - tileLeft );
				tileTop = iRow * _tileSize;
				tileBottom = tileTop + Math.min( _tileSize, zoomHeight - tileTop ); 
				
				if( !( tileLeft > canvasRight || tileRight < canvasLeft || tileTop > canvasBottom || tileBottom < canvasTop ) )
				{
					tile = tileZoomLevelArray[iColumn][iRow][_aGetTile];
					
					tileLeft += _offsetX;
					tileRight += _offsetX;
					tileTop += _offsetY;
					tileBottom += _offsetY;
					
					if( tile != null )
					{
						// Draw tile
						_ctx.drawImage( tile, tileLeft, tileTop );

						if( _debug )
						{
							_ctx.strokeRect( tileLeft, tileTop, _tileSize, _tileSize );
							tileCount++;
						}
					}
					else
					{
						//
						// Tile still loading
						//
						if( true )
						{
							_ctx.save();
							_ctx.beginPath();
						
							_ctx.moveTo( tileLeft, tileTop );
							_ctx.lineTo( tileRight, tileTop );
							_ctx.lineTo( tileRight, tileBottom );
							_ctx.lineTo( tileLeft, tileBottom );
							_ctx.closePath();

							_ctx.clip();
						
							// TODO: Fill with a lower zoom image. (or possible use combination of higher zooms??)
							// but scaling images in canvas still VERY SLOW.
							// THIS NOTABLY SLOWS DOWN PANNING WHEN IMAGES ARE NOT YET LOADED ON SOME BROWSERS.
							_ctx.drawImage( fullTile, _offsetX, _offsetY, zoomWidth, zoomHeight );
							
							_ctx.restore();
						}
						else
						{
							_ctx.fillStyle = "#999";
							_ctx.fillRect( tileLeft, tileTop, tileRight - tileLeft, tileBottom - tileTop );
						}
					}
				}
			}
		}
		
		//
		// Canvas area
		//
		_ctx.strokeStyle = "#000";
		_ctx.strokeRect( 0, 0, canvasWidth, canvasHeight );
		
		if( _debug )
		{
			// 
			// DEBUG!
			//
			_ctx.fillStyle = "#0f0";
			_ctx.font = "normal 12px Arial";
			
			// Text
			_ctx.fillText( _mouseX + "," + _mouseY + " | " + _offsetX + "," + _offsetY + " | " + tileCount, 0, 20 );
	
			// Grid
			_ctx.strokeStyle = "#f00";
			for( var y = 0; y < canvasHeight; y += _tileSize )
				for( var x = 0; x < canvasWidth; x += _tileSize )
					_ctx.strokeRect( x, y, _tileSize, _tileSize );
		}
	};

	setup();
}
