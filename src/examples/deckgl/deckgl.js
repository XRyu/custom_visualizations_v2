import Map from './map'
import React from 'react'
import ReactDOM from 'react-dom'


looker.plugins.visualizations.add({
  // Id and Label are legacy properties that no longer have any function besides documenting
  // what the visualization used to have. The properties are now set via the manifest
  // form within the admin/visualizations page of Looker
  id: "deckgl",
  label: "DeckGL",
  options: {
    font_size: {
      type: "string",
      label: "Font Size",
      values: [
        {"Large": "large"},
        {"Small": "small"}
      ],
      display: "radio",
      default: "large"
    }
  },
  // Set up the initial state of the visualization
  create: function(element, config) {

    // Insert a <style> tag with some styles we'll use later.
    element.innerHTML = `
      <style>
        html, body, #vis {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }
        .mapboxgl-canvas-container, .mapboxgl-canvas {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
        }
        .container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }
        .text-large {
          font-size: 24px;
          font-weight: 100;
          color: #3e3f40;
          font-family: "Open Sans","Noto Sans JP","Noto Sans","Noto Sans CJK KR",Helvetica,Arial,sans-serif;
        }
      </style>
    `;

    // Create a container element to let us center the contents
    this.container = element.appendChild(document.createElement('div'))
    this.container.className = 'container'

    // Render to the container element
    this.chart = ReactDOM.render(
      <h1 className="text-large">Loading visualization...</h1>,
      this.container,
    )
  },
  // Render in response to the data or settings changing
  updateAsync: function(data, element, config, queryResponse, details, done) {
    console.log('Looker sent updated data or settings', new Date(), {
      data,
      element,
      config,
      queryResponse,
      details,
    })

    // Clear any errors from previous updates
    this.clearErrors();

    // Throw some errors and exit if the shape of the data isn't what this chart needs
    if (queryResponse.fields.dimensions.length == 0) {
      this.addError({
        title: 'No Dimensions',
        message: 'DeckGL visualisation requires dimensions with geo data to work.',
      })
      return
    }

    if (data.length == 0) {
      this.addError({
        title: 'No Data',
        message: "Can't render DeckGL visualisation without data rows.",
      })
      return
    }

        // This keeps the loading spinner on until we're ready
    this.trigger('loadingStart', [])

    let mapboxToken
    let mapboxStyle = {}
    if (config.mapboxToken && config.mapboxStyleUrl) {
      mapboxToken = config.mapboxToken
      mapboxStyle = {
        id: 'custom_style',
        label: 'Custom style',
        url: config.mapboxStyleUrl,
        icon: '',
      }
    } else {
      // Here we try to extract global Mapbox style settings from visualization Dependencies
      try {
        mapboxToken = document.querySelector('script[src^="mapboxtoken:"]').src.split(':')[1]
        mapboxStyle = {
          id: 'custom_style',
          label: 'Custom style',
          url: document.querySelector('script[src^="mapbox://"]').src,
          icon: '',
        }
      } catch (e) {
        // Or just fall back to standard Uber style
        mapboxToken =
          'pk.eyJ1IjoidWJlcmRhdGEiLCJhIjoiY2poczJzeGt2MGl1bTNkcm1lcXVqMXRpMyJ9.9o2DrYg8C8UWmprj-tcVpQ'
      }
    }

    // Grab the first cell of the data
    let firstRow = data[0];
    const firstCell = firstRow[queryResponse.fields.dimensions[0].name].value;

    // Finally update the state with our new data
    this.chart = ReactDOM.render(
      <Map
        mapboxStyle={mapboxStyle}
        token={mapboxToken}
        data={data}
        config={config}
        // configUpdateCallback={configUpdateCallback}
        // lookerDoneCallback={() => {
        //   // We'll call this once everything is loaded and rendered
        //   this.trigger('loadingEnd', []);
        //   done();
        // }}
        // store={store}
        width={element.offsetWidth}
        height={element.offsetHeight}
      />,
      this.container,
      function(){ 
        // We are done rendering! Let Looker know.
        console.log("DeckGL rendered"); 
        done() 
      } 
    )

    // We are done rendering! Let Looker know.
    done()
  }
});
