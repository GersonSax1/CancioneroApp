import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, BackHandler, Button, FlatList, Image, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function App() {
  const [himnarios, setHimnarios] = useState([]); 
  const [himnarioActual, setHimnarioActual] = useState(null); 
  const [cancionActual, setCancionActual] = useState(null); 
  
  const [cancionesPersonales, setCancionesPersonales] = useState([]);
  const [verPersonales, setVerPersonales] = useState(false);

  const [favoritos, setFavoritos] = useState([]); 
  const [verSoloFavoritos, setVerSoloFavoritos] = useState(false);
  const [busqueda, setBusqueda] = useState(''); 
  const [tituloMoviendo, setTituloMoviendo] = useState(null); 
  const [fontSize, setFontSize] = useState(14); 
  
  const [modoEdicion, setModoEdicion] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [claveEntrada, setClaveEntrada] = useState('');
  const [cargando, setCargando] = useState(true);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [errorCritico, setErrorCritico] = useState(null);

  const [imagenAmpliada, setImagenAmpliada] = useState(null);
  const [modalLogoVisible, setModalLogoVisible] = useState(false);
  const [himnarioSeleccionadoLogo, setHimnarioSeleccionadoLogo] = useState(null);
  
  const [modalCancionVisible, setModalCancionVisible] = useState(false);
  const [tituloEditando, setTituloEditando] = useState('');
  const [letraEditando, setLetraEditando] = useState('');
  const [indiceEditando, setIndiceEditando] = useState(null);

  const [modalRenombrarVisible, setModalRenombrarVisible] = useState(false);
  const [himnarioSeleccionado, setHimnarioSeleccionado] = useState(null);
  const [nuevoNombreHimnario, setNuevoNombreHimnario] = useState('');
  const [nuevaClaveHimnario, setNuevaClaveHimnario] = useState('');

  const [modalClaveCarpetaVisible, setModalClaveCarpetaVisible] = useState(false);
  const [himnarioPendiente, setHimnarioPendiente] = useState(null);
  const [claveCarpetaInput, setClaveCarpetaInput] = useState('');

  const [tonoDelta, setTonoDelta] = useState(0);
  const [mostrarSaludo, setMostrarSaludo] = useState(true);
  const [verAcordes, setVerAcordes] = useState(true);
  
  const [menuFlotanteVisible, setMenuFlotanteVisible] = useState(false);

  const flatListRef = useRef(null);
  const [indiceUltimaCancion, setIndiceUltimaCancion] = useState(0);

  const CLAVE_SECRETA = "alabanza2026"; 

  // NUEVO: Lógica para arrastrar el botón flotante (PanResponder + Animated)
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      // Solo activar el modo "arrastrar" si el usuario mueve el dedo más de 10 píxeles. 
      // Si es menos, se considera un "toque" (clic normal) para abrir el menú.
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        pan.extractOffset(); // Guarda la posición actual antes de arrastrar
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false } // false porque estamos moviendo layout en pantalla
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset(); // Fija la nueva posición donde soltó el dedo
      }
    })
  ).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setMostrarSaludo(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const accionRetroceso = () => {
      if (cancionActual) { setCancionActual(null); return true; }
      if (himnarioActual) { setHimnarioActual(null); setVerSoloFavoritos(false); setBusqueda(''); setTituloMoviendo(null); return true; }
      if (verPersonales) { setVerPersonales(false); return true; } 
      return false; 
    };
    const manejadorRetroceso = BackHandler.addEventListener('hardwareBackPress', accionRetroceso);
    return () => manejadorRetroceso.remove();
  }, [cancionActual, himnarioActual, verPersonales]);

  useEffect(() => {
    const cargarDatosLocalesIniciales = async () => {
      try {
        const favsGuardados = await AsyncStorage.getItem('favoritosLocales');
        if (favsGuardados) setFavoritos(JSON.parse(favsGuardados));

        const himnariosLocales = await AsyncStorage.getItem('himnariosLocales');
        if (himnariosLocales) setHimnarios(JSON.parse(himnariosLocales));

        const personalesGuardados = await AsyncStorage.getItem('cancionesPersonales');
        if (personalesGuardados) setCancionesPersonales(JSON.parse(personalesGuardados));
      } catch (error) { 
      } finally {
        setCargando(false); 
      }
    };
    cargarDatosLocalesIniciales();

    try {
      const unsubscribe = onSnapshot(collection(db, 'himnarios'), async (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (data.length > 0) {
          setHimnarios(data);
          await AsyncStorage.setItem('himnariosLocales', JSON.stringify(data));
          if (himnarioActual) {
            const actualizado = data.find(h => h.id === himnarioActual.id);
            if (actualizado) setHimnarioActual(actualizado);
          }
        }
      }, (error) => {});
      return () => unsubscribe();
    } catch (e) {}
  }, [himnarioActual?.id]);

  useEffect(() => {
    if (!cancionActual && himnarioActual && flatListRef.current) {
      setTimeout(() => {
        try { flatListRef.current.scrollToIndex({ index: indiceUltimaCancion, animated: false }); } catch (error) {}
      }, 150);
    }
  }, [cancionActual]);

  useEffect(() => {
    setTonoDelta(0);
    setVerAcordes(true);
    setMenuFlotanteVisible(false);
  }, [cancionActual]);

  const transponerAcorde = (acordeOriginal, delta) => {
    const transponerBasico = (notaBase) => {
      const notasIngles = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const notasEspanol = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
      const equivalencias = {'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Reb': 'Do#', 'Mib': 'Re#', 'Solb': 'Fa#', 'Lab': 'Sol#', 'Sib': 'La#'};

      let match = notaBase.match(/^(Do|Re|Mi|Fa|Sol|La|Si)([#b]?)(.*)$/i) || notaBase.match(/^([CDEFGAB])([#b]?)(.*)$/i);
      if (!match) return notaBase;
      
      let esEspanol = /^(Do|Re|Mi|Fa|Sol|La|Si)/i.test(match[1]);
      let raiz = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      let alteracion = match[2].toLowerCase();
      let resto = match[3];

      let notaCompleta = raiz + alteracion;
      if (equivalencias[notaCompleta]) notaCompleta = equivalencias[notaCompleta];

      const arregloNotas = esEspanol ? notasEspanol : notasIngles;
      let index = arregloNotas.findIndex(n => n.toLowerCase() === notaCompleta.toLowerCase());

      if (index === -1) return notaBase;

      let nuevoIndex = (index + delta) % 12;
      if (nuevoIndex < 0) nuevoIndex += 12;

      return arregloNotas[nuevoIndex] + resto;
    };

    let acordeNuevo = "";
    
    if (acordeOriginal.includes('/')) {
      let partes = acordeOriginal.split('/');
      acordeNuevo = transponerBasico(partes[0]) + '/' + transponerBasico(partes[1]);
    } else {
      acordeNuevo = transponerBasico(acordeOriginal);
    }

    if (acordeNuevo.length < acordeOriginal.length) {
        acordeNuevo += " ".repeat(acordeOriginal.length - acordeNuevo.length);
    }
    
    return acordeNuevo;
  };

  const procesarLetraConAcordes = (texto, mostrarAcordes) => {
    const lineas = texto.split('\n');
    const chordRegex = /^((?:Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)[#b]?(?:m|maj|dim|aug|sus)?\d*(?:\/(?:Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)[#b]?)?)$/i;
    const etiquetasPermitidas = /^(INTRO|INTRODUCCIÓN|INTRODUCCION|PUENTE|CORO|INTERLUDIO|FINAL|VERSO|ESTROFA|PARTE)[.:\-]?$/i;

    const lineasProcesadas = lineas.map(linea => {
        const palabras = linea.trim().split(/\s+/);
        let cantidadAcordes = 0;

        const esLineaAcordes = linea.trim().length > 0 && palabras.every(p => {
            let pLimpia = p.replace(/^[\[\(\-¿¡]+|[\]\)\-\.:,!\?]+$/g, '');
            
            if (pLimpia === '' || p === '-' || p === '|' || p === '–' || p === '/') return true;
            if (etiquetasPermitidas.test(pLimpia)) return true;
            if (/^[xX]\d+$/.test(pLimpia)) return true;
            if (/^[A-Z0-9]$/i.test(pLimpia) || /^\d+$/.test(pLimpia)) return true;

            if (chordRegex.test(pLimpia)) {
                cantidadAcordes++;
                return true;
            }
            return false;
        });

        if (esLineaAcordes && cantidadAcordes > 0 && !mostrarAcordes) {
            return null;
        }

        if (esLineaAcordes && cantidadAcordes > 0 && mostrarAcordes && tonoDelta !== 0) {
            return linea.split(/(\s+|-|\(|\)|\[|\]|\||:|\.)/).map(fragmento => {
                if (chordRegex.test(fragmento) && !etiquetasPermitidas.test(fragmento) && !/^[xX]\d+$/i.test(fragmento)) {
                    return transponerAcorde(fragmento, tonoDelta);
                }
                return fragmento;
            }).join('');
        }
        
        return linea;
    });

    return lineasProcesadas.filter(linea => linea !== null).join('\n');
  };

  const toggleFavorito = async (titulo) => {
    let nuevosFavs = favoritos.includes(titulo) ? favoritos.filter(f => f !== titulo) : [...favoritos, titulo];
    setFavoritos(nuevosFavs);
    await AsyncStorage.setItem('favoritosLocales', JSON.stringify(nuevosFavs));
  };

  const moverCancion = async (cancion, direccion) => {
    if (!himnarioActual) return;
    const indexReal = himnarioActual.canciones.findIndex(c => c.titulo === cancion.titulo);
    const nuevas = [...himnarioActual.canciones];
    const nuevoIndex = indexReal + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= nuevas.length) return;
    [nuevas[indexReal], nuevas[nuevoIndex]] = [nuevas[nuevoIndex], nuevas[indexReal]];
    const actualizado = { ...himnarioActual, canciones: nuevas };
    setHimnarioActual(actualizado);
    await setDoc(doc(db, 'himnarios', actualizado.id), actualizado);
  };

  const guardarCancionManual = async () => {
    if (!tituloEditando.trim() || !letraEditando.trim()) {
      Alert.alert("Error", "El título y la letra no pueden estar vacíos.");
      return;
    }

    if (verPersonales && !himnarioActual) {
      let cancionesActuales = [...cancionesPersonales];
      if (indiceEditando !== null) {
        cancionesActuales[indiceEditando] = { titulo: tituloEditando.trim(), letra: letraEditando.trim() };
      } else {
        cancionesActuales.push({ titulo: tituloEditando.trim(), letra: letraEditando.trim() });
      }
      setCancionesPersonales(cancionesActuales);
      await AsyncStorage.setItem('cancionesPersonales', JSON.stringify(cancionesActuales));
      setModalCancionVisible(false);
      setTituloEditando('');
      setLetraEditando('');
      setIndiceEditando(null);
      return;
    }

    let cancionesActuales = [...himnarioActual.canciones];
    if (indiceEditando !== null) {
      cancionesActuales[indiceEditando] = { titulo: tituloEditando.trim(), letra: letraEditando.trim() };
    } else {
      cancionesActuales.push({ titulo: tituloEditando.trim(), letra: letraEditando.trim() });
    }
    const himnarioActualizado = { ...himnarioActual, canciones: cancionesActuales };
    setHimnarioActual(himnarioActualizado);
    setModalCancionVisible(false);
    setTituloEditando('');
    setLetraEditando('');
    setIndiceEditando(null);

    try {
      await setDoc(doc(db, 'himnarios', himnarioActualizado.id), himnarioActualizado);
      Alert.alert("Éxito", "Cambios guardados en la biblioteca global.");
    } catch (error) {}
  };

  const guardarNuevoNombreHimnario = async () => {
    if (!nuevoNombreHimnario.trim()) {
      Alert.alert("Error", "El nombre de la carpeta no puede estar vacío.");
      return;
    }
    try {
      const himnarioActualizado = { 
        ...himnarioSeleccionado, 
        titulo: nuevoNombreHimnario.trim(),
        claveAcceso: nuevaClaveHimnario.trim()
      };
      await setDoc(doc(db, 'himnarios', himnarioActualizado.id), himnarioActualizado);
      setModalRenombrarVisible(false);
      setHimnarioSeleccionado(null);
      setNuevoNombreHimnario('');
      setNuevaClaveHimnario('');
      Alert.alert("Éxito", "Carpeta actualizada.");
    } catch (error) {}
  };

  const eliminarCancion = (indexReal) => {
    Alert.alert(
      "Eliminar Canción",
      "¿Estás seguro de que deseas borrar esta canción?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Borrar", 
          style: "destructive", 
          onPress: async () => {
            if (verPersonales && !himnarioActual) {
              const nuevas = cancionesPersonales.filter((_, i) => i !== indexReal);
              setCancionesPersonales(nuevas);
              await AsyncStorage.setItem('cancionesPersonales', JSON.stringify(nuevas));
              if (cancionActual) setCancionActual(null);
              return;
            }

            const nuevasCanciones = himnarioActual.canciones.filter((_, i) => i !== indexReal);
            const himnarioActualizado = { ...himnarioActual, canciones: nuevasCanciones };
            setHimnarioActual(himnarioActualizado);
            if (cancionActual) setCancionActual(null);
            try {
              await setDoc(doc(db, 'himnarios', himnarioActualizado.id), himnarioActualizado);
            } catch (error) {}
          } 
        }
      ]
    );
  };

  const eliminarHimnario = (id, titulo) => {
    Alert.alert(
      "Eliminar Carpeta",
      `¿Estás seguro de que deseas borrar completamente la carpeta "${titulo}" y todas sus canciones? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Borrar", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'himnarios', id));
              if (himnarioActual && himnarioActual.id === id) {
                setHimnarioActual(null);
              }
            } catch (error) {
              Alert.alert("Error", "No se pudo eliminar la carpeta en la base de datos.");
            }
          } 
        }
      ]
    );
  };

  const abrirModalCrearOEditar = (cancion = null, index = null) => {
    if (cancion) {
      setTituloEditando(cancion.titulo);
      setLetraEditando(cancion.letra);
      setIndiceEditando(index);
    } else {
      setTituloEditando('');
      setLetraEditando('');
      setIndiceEditando(null);
    }
    setModalCancionVisible(true);
  };

  const manejarToqueLogo = (himnario) => {
    if (!himnario.logoUrl) return;
    if (modoEdicion) {
      setHimnarioSeleccionadoLogo(himnario);
      setModalLogoVisible(true);
    } else {
      setImagenAmpliada(himnario.logoUrl);
    }
  };

  const cambiarLogo = async (himnarioId) => {
    let resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!resultado.canceled) {
      const uriImagen = resultado.assets[0].uri;
      try {
        const himnarioRef = doc(db, 'himnarios', himnarioId);
        await setDoc(himnarioRef, { logoUrl: uriImagen }, { merge: true });
        if (himnarioActual && himnarioActual.id === himnarioId) {
          setHimnarioActual(prev => ({ ...prev, logoUrl: uriImagen }));
        }
        setModalLogoVisible(false);
      } catch (error) {}
    }
  };

  const seleccionarArchivo = async (esLocal = false) => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (resultado.canceled) return;
      subirAlServidor(resultado.assets[0], esLocal);
    } catch (error) {}
  };

  const subirAlServidor = async (archivo, esLocal = false) => {
    setSubiendoArchivo(true);
    const nombreOriginal = archivo.name || "documento.pdf";
    const tituloLimpio = nombreOriginal.replace(/\.[^/.]+$/, "");

    try {
      const formData = new FormData();
      if (archivo.file) {
        formData.append('file', archivo.file);
      } else {
        const response = await fetch(archivo.uri);
        const blob = await response.blob();
        formData.append('file', blob, nombreOriginal);
      }

      const resServidor = await fetch('https://cancionerobackend.onrender.com/procesar-documento/', {
        method: 'POST',
        body: formData,
      });

      const data = await resServidor.json();
      if (!resServidor.ok) throw new Error(data.detail || `Error del servidor: ${resServidor.status}`);
      
      if (data.canciones) {
        if (esLocal) {
          const nuevasPersonales = [...cancionesPersonales, ...data.canciones];
          setCancionesPersonales(nuevasPersonales);
          await AsyncStorage.setItem('cancionesPersonales', JSON.stringify(nuevasPersonales));
          Alert.alert("Completado", `Se agregaron ${data.canciones.length} oportunidades.`);
        } else {
          let himnarioGuardar;
          if (himnarioActual) {
            himnarioGuardar = { ...himnarioActual, canciones: [...himnarioActual.canciones, ...data.canciones] };
            setHimnarioActual(himnarioGuardar); 
            Alert.alert("Completado", `Se agregaron ${data.canciones.length} canciones nuevas.`);
          } else {
            himnarioGuardar = { id: Date.now().toString(), titulo: tituloLimpio, logoUrl: "", canciones: data.canciones, claveAcceso: "" };
            Alert.alert("Completado", `Se guardó la carpeta "${tituloLimpio}".`);
          }
          await setDoc(doc(db, 'himnarios', himnarioGuardar.id), himnarioGuardar);
        }
      } 
    } catch (error) {
      Alert.alert("Fallo", `Detalle: ${error.message}`);
    } finally {
      setSubiendoArchivo(false); 
    }
  };

  const obtenerCancionesFiltradas = () => {
    if (!himnarioActual) return [];
    const conNum = himnarioActual.canciones.map((c, i) => ({ ...c, numeroOriginal: i + 1, indexReal: i }));
    return conNum.filter(c => {
      if (verSoloFavoritos && !favoritos.includes(c.titulo)) return false;
      if (busqueda.trim() === '') return true;
      const term = busqueda.toLowerCase().trim();
      return /^\d+$/.test(term) ? c.numeroOriginal.toString() === term : c.titulo.toLowerCase().includes(term) || (c.letra && c.letra.toLowerCase().includes(term));
    });
  };

  if (errorCritico) {
    return (
      <SafeAreaView style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <Text style={{color: '#ff5252', fontSize: 18, textAlign: 'center', marginBottom: 20}}>⚠️ Error:</Text>
        <Text style={{color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 20}}>{errorCritico}</Text>
        <Button title="Reintentar" color="#03dac6" onPress={() => setErrorCritico(null)} />
      </SafeAreaView>
    );
  }

  // NUEVO DISEÑO PARA LA PANTALLA DE CARGA
  if (mostrarSaludo) {
    return (
      <SafeAreaView style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <Text style={{fontSize: 34, fontWeight: 'bold', color: '#bb86fc', marginBottom: 10, textAlign: 'center'}}>
          Dios Te Bendiga
        </Text>
        <Text style={{color: '#888', fontSize: 16, textAlign: 'center', marginBottom: 40}}>
          Creador de la aplicación:{'\n'}Gerson Aquevedo Pérez
        </Text>
        <ActivityIndicator size="large" color="#03dac6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      {subiendoArchivo && (
        <View style={styles.overlayCarga}>
          <ActivityIndicator size="large" color="#03dac6" />
          <Text style={styles.textoCarga}>Procesando documento...</Text>
        </View>
      )}

      <View style={styles.headerTop}>
        <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
          {himnarioActual?.logoUrl ? (
            <TouchableOpacity onPress={() => manejarToqueLogo(himnarioActual)}>
              <Image source={{ uri: himnarioActual.logoUrl }} style={styles.logoCoro} />
            </TouchableOpacity>
          ) : himnarioActual && modoEdicion ? (
            <TouchableOpacity onPress={() => cambiarLogo(himnarioActual.id)} style={styles.btnAgregarLogo}>
              <Text style={{color: '#03dac6', fontSize: 11, textAlign: 'center'}}>+ Logo</Text>
            </TouchableOpacity>
          ) : null}
          
          <Text style={[styles.headerTitle, himnarioActual?.logoUrl && { marginLeft: 10 }]} numberOfLines={1}>
            {himnarioActual ? himnarioActual.titulo : "CancioneroApp"}
          </Text>
        </View>

        {!verPersonales && (
          <TouchableOpacity onPress={() => modoEdicion ? setModoEdicion(false) : setModalVisible(true)}>
            <Text style={styles.btnDesbloquear}>{modoEdicion ? "🔓 Salir" : "🔒"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!cargando && !cancionActual && !himnarioActual && (
        <View style={styles.selectorSeccion}>
          <TouchableOpacity style={[styles.btnSeccion, !verPersonales && styles.btnSeccionActivo]} onPress={() => setVerPersonales(false)}>
            <Text style={[styles.textoSeccion, !verPersonales && styles.textoSeccionActivo]}>📚 Globales</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnSeccion, verPersonales && styles.btnSeccionActivo]} onPress={() => setVerPersonales(true)}>
            <Text style={[styles.textoSeccion, verPersonales && styles.textoSeccionActivo]}>🎤 Mis Oportunidades</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {cargando && himnarios.length === 0 ? <ActivityIndicator size="large" color="#03dac6" /> : cancionActual ? (
        <View style={styles.vistaCancion}>
          
          <View style={styles.headerVistaCancion}>
            <TouchableOpacity style={styles.btnVolver} onPress={() => setCancionActual(null)}>
              <Text style={styles.btnVolverTexto}>⬅ Volver</Text>
            </TouchableOpacity>
            
            {(modoEdicion || (verPersonales && !himnarioActual)) && (
                <TouchableOpacity style={[styles.btnZoom, {backgroundColor: '#bb86fc', alignSelf: 'center'}]} onPress={() => {
                  let idxReal;
                  if (verPersonales && !himnarioActual) {
                    idxReal = cancionesPersonales.findIndex(c => c.titulo === cancionActual.titulo);
                  } else {
                    idxReal = himnarioActual.canciones.findIndex(c => c.titulo === cancionActual.titulo);
                  }
                  abrirModalCrearOEditar(cancionActual, idxReal);
                }}>
                  <Text style={[styles.btnZoomText, {color: '#000'}]}>✏️ Editar</Text>
                </TouchableOpacity>
            )}
          </View>

          <View style={styles.controlesSuperiores}>
            {verAcordes && (
              <View style={styles.zoomContainer}>
                <TouchableOpacity style={styles.btnZoom} onPress={() => setTonoDelta(prev => prev - 1)}>
                  <Text style={styles.btnZoomText}>-½ Tono</Text>
                </TouchableOpacity>
                <View style={styles.indicadorTono}>
                  <Text style={{color: '#03dac6', fontWeight: 'bold'}}>{tonoDelta > 0 ? `+${tonoDelta}` : tonoDelta}</Text>
                </View>
                <TouchableOpacity style={styles.btnZoom} onPress={() => setTonoDelta(prev => prev + 1)}>
                  <Text style={styles.btnZoomText}>+½ Tono</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.tituloCompleto}>{cancionActual.titulo}</Text>
            <View style={{ alignItems: 'flex-start', width: '100%', paddingHorizontal: 5 }}>
              <Text style={[
                styles.lineaLetra, 
                { fontSize: fontSize },
                Platform.OS === 'web' ? { whiteSpace: 'pre-wrap' } : {}
              ]}>
                {procesarLetraConAcordes(cancionActual.letra, verAcordes)}
              </Text>
            </View>
            <View style={{height: 100}}/>
          </ScrollView>

          {/* CONTENEDOR FLOTANTE CON ANIMATED PARA PODER ARRASTRARLO */}
          <Animated.View 
            style={[styles.fabVistaContainer, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
            {...panResponder.panHandlers}
          >
            {menuFlotanteVisible && (
              <View style={styles.menuFlotante}>
                <TouchableOpacity 
                  style={[styles.btnZoomFlotante, {backgroundColor: verAcordes ? '#03dac6' : '#444', marginBottom: 15}]} 
                  onPress={() => setVerAcordes(!verAcordes)}
                >
                  <Text style={[styles.btnZoomText, {color: verAcordes ? '#000' : '#fff'}]}>
                    {verAcordes ? '🎵 Acordes' : '📖 Letra'}
                  </Text>
                </TouchableOpacity>

                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                  <TouchableOpacity style={[styles.btnZoomFlotante, {flex: 1, marginRight: 5}]} onPress={() => setFontSize(prev => Math.max(12, prev - 2))}>
                    <Text style={styles.btnZoomText}>A-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnZoomFlotante, {flex: 1, marginLeft: 5}]} onPress={() => setFontSize(prev => Math.min(32, prev + 2))}>
                    <Text style={styles.btnZoomText}>A+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.fabVista} 
              onPress={() => setMenuFlotanteVisible(!menuFlotanteVisible)}
            >
              <Text style={{fontSize: 26}}>{menuFlotanteVisible ? '✖️' : '⚙️'}</Text>
            </TouchableOpacity>
          </Animated.View>
          
        </View>
      ) : himnarioActual ? (
        <View style={{ flex: 1 }}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
            <TouchableOpacity style={styles.btnVolver} onPress={() => { setHimnarioActual(null); setBusqueda(''); setIndiceUltimaCancion(0); }}>
              <Text style={styles.btnVolverTexto}>⬅ Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setVerSoloFavoritos(!verSoloFavoritos)}>
              <Text style={{ color: verSoloFavoritos ? '#FFD700' : '#888', fontWeight: 'bold' }}>
                {verSoloFavoritos ? '★ Favoritos' : '☆ Ver Favoritos'}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput style={styles.inputBusqueda} placeholder="Buscar..." value={busqueda} onChangeText={setBusqueda} placeholderTextColor="#888" />
          
          <FlatList 
            ref={flatListRef}
            data={obtenerCancionesFiltradas()} 
            keyExtractor={(item) => item.numeroOriginal.toString()} 
            getItemLayout={(data, index) => ({ length: 80, offset: 80 * index, index })}
            renderItem={({ item, index }) => (
              <View style={[styles.itemIndice, tituloMoviendo === item.titulo && { borderColor: '#03dac6', borderWidth: 1 }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => { setIndiceUltimaCancion(index); setCancionActual(item); }} onLongPress={() => modoEdicion && setTituloMoviendo(item.titulo)}>
                  <Text style={styles.tituloIndice}>{item.numeroOriginal}. {item.titulo}</Text>
                </TouchableOpacity>
                
                {modoEdicion && (
                  <TouchableOpacity onPress={() => abrirModalCrearOEditar(item, item.indexReal)} style={{paddingHorizontal: 8}}>
                    <Text style={{fontSize: 18}}>✏️</Text>
                  </TouchableOpacity>
                )}

                {modoEdicion && (
                  <TouchableOpacity onPress={() => eliminarCancion(item.indexReal)} style={{paddingHorizontal: 8}}>
                    <Text style={{fontSize: 18}}>🗑️</Text>
                  </TouchableOpacity>
                )}

                {tituloMoviendo === item.titulo ? (
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <TouchableOpacity onPress={()=>moverCancion(item, -1)} style={{padding: 5}}><Text style={{fontSize: 18}}>🔼</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>moverCancion(item, 1)} style={{padding: 5}}><Text style={{fontSize: 18}}>🔽</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>setTituloMoviendo(null)} style={{padding: 5, backgroundColor: '#03dac6', borderRadius: 5, marginLeft: 5}}><Text style={{fontWeight: 'bold', color: '#000'}}>OK</Text></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => toggleFavorito(item.titulo)}>
                    <Text style={{fontSize: 24, color: favoritos.includes(item.titulo) ? '#FFD700' : '#444'}}>★</Text>
                  </TouchableOpacity>
                )}
              </View>
            )} 
          />
        </View>
      ) : verPersonales ? (
        <View style={{ flex: 1 }}>
          <Text style={{color: '#aaa', textAlign: 'center', marginBottom: 15}}>
            Privado: Estas canciones solo se guardan en tu celular.
          </Text>
          {cancionesPersonales.length === 0 ? (
            <Text style={{color: '#555', textAlign: 'center', marginTop: 50}}>Aún no tienes oportunidades guardadas.</Text>
          ) : (
            <FlatList 
              data={cancionesPersonales.map((c, i) => ({ ...c, numeroOriginal: i + 1, indexReal: i }))} 
              keyExtractor={(item, index) => index.toString()} 
              renderItem={({ item }) => (
                <View style={styles.itemIndice}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setCancionActual(item)}>
                    <Text style={styles.tituloIndice}>{item.numeroOriginal}. {item.titulo}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={() => abrirModalCrearOEditar(item, item.indexReal)} style={{paddingHorizontal: 8}}>
                    <Text style={{fontSize: 18}}>✏️</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => eliminarCancion(item.indexReal)} style={{paddingHorizontal: 8}}>
                    <Text style={{fontSize: 18}}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )} 
            />
          )}
        </View>
      ) : (
        <FlatList data={himnarios} keyExtractor={(item) => item.id} renderItem={({ item }) => (
          <View style={styles.tarjetaHimnario}>
            <TouchableOpacity style={styles.btnHimnario} onPress={() => { 
              if (item.claveAcceso && item.claveAcceso.trim() !== '' && !modoEdicion) {
                setHimnarioPendiente(item);
                setModalClaveCarpetaVisible(true);
              } else {
                setHimnarioActual(item); 
                setIndiceUltimaCancion(0); 
              }
            }}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                {item.logoUrl ? (
                  <TouchableOpacity onPress={() => manejarToqueLogo(item)}>
                    <Image source={{ uri: item.logoUrl }} style={styles.logoTarjeta} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Text style={{color: '#03dac6', fontSize: 14, fontWeight: 'bold'}}>🎵</Text>
                  </View>
                )}
                <Text style={[styles.tituloHimnario, {marginLeft: 15, marginRight: modoEdicion ? 130 : 0}]}>
                  {item.titulo} {item.claveAcceso && !modoEdicion ? '🔒' : ''}
                </Text>
              </View>
            </TouchableOpacity>

            {modoEdicion && (
              <View style={styles.botonesEdicionCarpeta}>
                <TouchableOpacity style={styles.btnMiniAccion} onPress={() => {
                  setHimnarioSeleccionado(item);
                  setNuevoNombreHimnario(item.titulo);
                  setNuevaClaveHimnario(item.claveAcceso || '');
                  setModalRenombrarVisible(true);
                }}>
                  <Text style={{fontSize: 18}}>✏️</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnMiniAccion} onPress={() => {
                  if (item.logoUrl) {
                     setHimnarioSeleccionadoLogo(item);
                     setModalLogoVisible(true);
                  } else {
                     cambiarLogo(item.id);
                  }
                }}>
                  <Text style={{fontSize: 18}}>🖼️</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnMiniAccion} onPress={() => eliminarHimnario(item.id, item.titulo)}>
                  <Text style={{fontSize: 18}}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )} />
      )}

      {!cancionActual && (
        <View style={{position: 'absolute', bottom: 45, right: 20, flexDirection: 'row'}}>
          
          {himnarioActual && modoEdicion && (
            <TouchableOpacity style={[styles.fab, {backgroundColor: '#03dac6', marginRight: 10}]} onPress={() => abrirModalCrearOEditar()}>
              <Text style={[styles.fabIcon, {color: '#000'}]}>+ Crear Canción</Text>
            </TouchableOpacity>
          )}

          {himnarioActual && modoEdicion && (
            <TouchableOpacity style={styles.fab} onPress={() => seleccionarArchivo(false)}>
              <Text style={styles.fabIcon}>+ Subir Archivo</Text>
            </TouchableOpacity>
          )}

          {!himnarioActual && !verPersonales && modoEdicion && (
            <TouchableOpacity style={styles.fab} onPress={() => seleccionarArchivo(false)}>
              <Text style={styles.fabIcon}>+ Nuevo Himnario</Text>
            </TouchableOpacity>
          )}

          {!himnarioActual && verPersonales && (
            <>
              <TouchableOpacity style={[styles.fab, {backgroundColor: '#bb86fc', marginRight: 10}]} onPress={() => abrirModalCrearOEditar()}>
                <Text style={[styles.fabIcon, {color: '#000'}]}>+ Escribir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fab} onPress={() => seleccionarArchivo(true)}>
                <Text style={styles.fabIcon}>+ Subir Archivo</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      )}

      <Modal visible={modalRenombrarVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Ajustes de Carpeta</Text>
            
            <Text style={{color: '#aaa', alignSelf: 'flex-start', marginBottom: 5}}>Nombre:</Text>
            <TextInput 
              style={styles.inputClave} 
              value={nuevoNombreHimnario} 
              onChangeText={setNuevoNombreHimnario} 
              placeholder="Nombre de la iglesia..." 
              placeholderTextColor="#888" 
            />

            <Text style={{color: '#aaa', alignSelf: 'flex-start', marginBottom: 5}}>Contraseña (Opcional):</Text>
            <TextInput 
              style={styles.inputClave} 
              value={nuevaClaveHimnario} 
              onChangeText={setNuevaClaveHimnario} 
              placeholder="Dejar vacío para acceso libre" 
              placeholderTextColor="#888" 
            />

            <View style={styles.modalButtons}>
              <Button title="Cancelar" color="#ff5252" onPress={() => setModalRenombrarVisible(false)} />
              <Button title="Guardar" color="#03dac6" onPress={guardarNuevoNombreHimnario} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalClaveCarpetaVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Carpeta Privada</Text>
            <Text style={{color: '#aaa', textAlign: 'center', marginBottom: 15}}>
              Este himnario está protegido. Ingresa la contraseña para verlo.
            </Text>
            <TextInput 
              style={styles.inputClave} 
              secureTextEntry 
              value={claveCarpetaInput} 
              onChangeText={setClaveCarpetaInput} 
              placeholder="Contraseña..." 
              placeholderTextColor="#888" 
            />
            <View style={styles.modalButtons}>
              <Button title="Cancelar" color="#ff5252" onPress={() => {
                setModalClaveCarpetaVisible(false);
                setClaveCarpetaInput('');
                setHimnarioPendiente(null);
              }} />
              <Button title="Entrar" color="#bb86fc" onPress={() => { 
                if(claveCarpetaInput === himnarioPendiente?.claveAcceso) {
                  setHimnarioActual(himnarioPendiente);
                  setIndiceUltimaCancion(0);
                  setModalClaveCarpetaVisible(false);
                  setClaveCarpetaInput('');
                  setHimnarioPendiente(null);
                } else { 
                  Alert.alert("Denegado", "La contraseña es incorrecta"); 
                } 
              }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalCancionVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalView, {width: '90%', maxHeight: '85%'}]}>
            <Text style={styles.modalTitle}>{indiceEditando !== null ? "Editar Canción" : "Nueva Canción"}</Text>
            
            <Text style={{color: '#aaa', alignSelf: 'flex-start', marginBottom: 5}}>Título de la canción:</Text>
            <TextInput 
              style={styles.inputClave} 
              value={tituloEditando} 
              onChangeText={setTituloEditando} 
              placeholder="Ej: Grande es tu fidelidad" 
              placeholderTextColor="#888" 
            />

            <Text style={{color: '#aaa', alignSelf: 'flex-start', marginBottom: 5}}>Letra:</Text>
            <TextInput 
              style={[styles.inputClave, {height: 180, textAlignVertical: 'top'}]} 
              value={letraEditando} 
              onChangeText={setLetraEditando} 
              placeholder="Escribe la letra aquí..." 
              placeholderTextColor="#888" 
              multiline 
            />

            <View style={styles.modalButtons}>
              <Button title="Cancelar" color="#ff5252" onPress={() => setModalCancionVisible(false)} />
              <Button title="Guardar" color="#03dac6" onPress={guardarCancionManual} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={imagenAmpliada !== null} transparent animationType="fade">
        <View style={styles.modalOverlayVisor}>
          <TouchableOpacity style={styles.btnCerrarVisor} onPress={() => setImagenAmpliada(null)}>
            <Text style={{color: '#fff', fontSize: 18, fontWeight: 'bold'}}>✕ Cerrar</Text>
          </TouchableOpacity>
          {imagenAmpliada && (
            <Image source={{ uri: imagenAmpliada }} style={styles.imagenCompleta} resizeMode="contain" />
          )}
        </View>
      </Modal>

      <Modal visible={modalLogoVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Gestión de Logo</Text>
            <Text style={{color: '#aaa', textAlign: 'center', marginBottom: 20}}>
              Carpeta: {himnarioSeleccionadoLogo?.titulo}
            </Text>
            
            <Button title="Ver Imagen Completa" color="#03dac6" onPress={() => { setModalLogoVisible(false); setImagenAmpliada(himnarioSeleccionadoLogo?.logoUrl); }} />
            
            <View style={{height: 15}} />

            <Button title="Cambiar Logo" color="#bb86fc" onPress={() => {
              cambiarLogo(himnarioSeleccionadoLogo.id);
            }} />

            <View style={{height: 15}} />
            <Button title="Cancelar" color="#ff5252" onPress={() => setModalLogoVisible(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Ingresar Contraseña</Text>
            <TextInput style={styles.inputClave} secureTextEntry value={claveEntrada} onChangeText={setClaveEntrada} placeholder="Clave..." placeholderTextColor="#888" />
            <View style={styles.modalButtons}>
              <Button title="Cancelar" color="#ff5252" onPress={() => setModalVisible(false)} />
              <Button title="Entrar" color="#03dac6" onPress={() => { if(claveEntrada === CLAVE_SECRETA) {setModoEdicion(true); setModalVisible(false); setClaveEntrada('');} else { Alert.alert("Error", "Clave incorrecta"); } }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 20 },
  overlayCarga: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  textoCarga: { color: '#03dac6', marginTop: 15, fontSize: 18, fontWeight: 'bold' },
  textoCargaSecundario: { color: '#aaa', marginTop: 5, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  selectorSeccion: { flexDirection: 'row', backgroundColor: '#1e1e1e', borderRadius: 8, padding: 4, marginBottom: 15, marginTop: 5 },
  btnSeccion: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  btnSeccionActivo: { backgroundColor: '#333' },
  textoSeccion: { color: '#888', fontWeight: 'bold', fontSize: 16 },
  textoSeccionActivo: { color: '#03dac6' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#bb86fc', flex: 1 },
  logoCoro: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#03dac6' },
  logoTarjeta: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 1.5, borderColor: '#03dac6' },
  logoPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#03dac6', borderStyle: 'dashed' },
  botonesEdicionCarpeta: { position: 'absolute', right: 15, top: 15, flexDirection: 'row' },
  btnMiniAccion: { backgroundColor: '#252525', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#03dac6', marginLeft: 8 },
  btnDesbloquear: { fontSize: 20, color: '#03dac6', paddingLeft: 10 },
  tarjetaHimnario: { backgroundColor: '#1e1e1e', borderRadius: 12, marginBottom: 15, justifyContent: 'center' },
  btnHimnario: { padding: 15 },
  tituloHimnario: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1 },
  itemIndice: { flexDirection: 'row', backgroundColor: '#1e1e1e', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center', height: 70 },
  tituloIndice: { color: '#fff', fontSize: 18, flex: 1 },
  inputBusqueda: { backgroundColor: '#1e1e1e', color: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, fontSize: 16 },
  btnVolver: { padding: 10, backgroundColor: '#333', borderRadius: 8, alignSelf: 'flex-start' },
  btnVolverTexto: { color: '#03dac6', fontWeight: 'bold' },
  vistaCancion: { flex: 1, marginTop: 10, position: 'relative' },
  headerVistaCancion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  controlesSuperiores: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5 },
  zoomContainer: { flexDirection: 'row', marginHorizontal: 5, marginVertical: 5 },
  btnZoom: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginLeft: 4 },
  btnZoomText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  indicadorTono: { justifyContent: 'center', paddingHorizontal: 10, backgroundColor: '#222', borderRadius: 6, marginLeft: 4, borderWidth: 1, borderColor: '#333' },
  tituloCompleto: { fontSize: 24, color: '#bb86fc', textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  lineaLetra: { 
    color: '#ccc', 
    textAlign: 'left', 
    lineHeight: 28, 
    fontFamily: Platform.OS === 'web' ? 'Consolas, "Courier New", monospace' : 'monospace'
  },
  fab: { backgroundColor: '#bb86fc', padding: 15, borderRadius: 30, elevation: 5 },
  fabIcon: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  fabVistaContainer: { position: 'absolute', bottom: 20, right: 10, alignItems: 'flex-end' },
  menuFlotante: { backgroundColor: '#252525', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 5, borderWidth: 1, borderColor: '#333', width: 220 },
  btnZoomFlotante: { backgroundColor: '#333', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fabVista: { backgroundColor: '#03dac6', width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20 },
  modalOverlayVisor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  btnCerrarVisor: { position: 'absolute', top: 40, right: 20, backgroundColor: '#333', padding: 10, borderRadius: 8, zIndex: 10 },
  imagenCompleta: { width: '90%', height: '80%' },
  modalView: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 10, alignItems: 'center', width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  inputClave: { width: '100%', backgroundColor: '#333', color: '#fff', padding: 12, marginBottom: 15, borderRadius: 5, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' }
});