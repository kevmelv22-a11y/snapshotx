import React from 'react';
import MapView,{Marker} from 'react-native-maps';
export type Pin={id:string;name:string;latitude:number;longitude:number};
export default function FriendMap({pins}:{pins:Pin[]}){return <MapView style={{flex:1}} initialRegion={{latitude:pins[0]?.latitude??52.1,longitude:pins[0]?.longitude??5.1,latitudeDelta:.18,longitudeDelta:.18}}>{pins.map(p=><Marker key={p.id} coordinate={{latitude:p.latitude,longitude:p.longitude}} title={p.name}/>)}</MapView>}
