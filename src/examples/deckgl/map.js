import React, { Component } from 'react'

import DeckGL from '@deck.gl/react'
import {LineLayer} from '@deck.gl/layers';
import {StaticMap} from 'react-map-gl';



// Viewport settings
const INITIAL_VIEW_STATE = {
  longitude: -122.41669,
  latitude: 37.7853,
  zoom: 13,
  pitch: 0,
  bearing: 0
};

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidWJlcmRhdGEiLCJhIjoiY2poczJzeGt2MGl1bTNkcm1lcXVqMXRpMyJ9.9o2DrYg8C8UWmprj-tcVpQ';

let mapdata = [
  {sourcePosition: [-122.41669, 37.7853], targetPosition: [-122.41669, 37.781]}
];

let layers = [
  new LineLayer({id: 'line-layer', mapdata})
];

// Create (or import) our react component
export default class Map extends Component {
  constructor (props) {
    // So we have access to 'this'
    super(props)
  }


  // render our data
  render() {
    return (
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        id="map"
        width={this.props.width}
        height={this.props.height}
      >
        <StaticMap mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN} />
      </DeckGL>
    )
  }
}
