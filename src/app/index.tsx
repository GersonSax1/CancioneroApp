import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Button, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function App() {
  const [himnarios, setHimnarios] = useState([]); 
  const [himnarioActual, setHimnarioActual] = useState(null); 
  const [cancionActual, setCancionActual] = useState(null); 
  
  const [favoritos, setFavoritos] = useState([]); 
  const [verSoloFavoritos, setVerSoloFavoritos] = useState(false);
  const [busqueda, setBusqueda] = useState(''); 
  const [tituloMoviendo, setTituloMoviendo] = useState(null); 
  const [fontSize, setFontSize] = useState(18); 
  
  const [modoEdicion, setModoEdicion] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [claveEntrada, setClaveEntrada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorCritico, setErrorCritico] = useState(null);

  // Estados para imágenes y control de scroll por índice exacto
  const [imagenAmpliada, setImagenAmpliada] = useState(null);
  const [modalLogoVisible, setModalLogoVisible] = useState(false);
  const [himnarioSeleccionadoLogo, setHimnarioSeleccionadoLogo] = useState(null);
  
  // Estados para edición y creación de canciones manuales
  const [modalCancionVisible, setModalCancionVisible] = useState(false);
  const [tituloEditando, setTituloEditando] = useState('');
  const [letraEditando, setLetraEditando] = useState('');
  const [indiceEditando, setIndiceEditando] = useState(null);

  const flatListRef = useRef(null);
  const [indiceUltimaCancion, setIndiceUltimaCancion] = useState(0);

  const CLAVE_SECRETA = "alabanza2026"; 

  useEffect(() => {
    const accionRetroceso = () => {
      if (cancionActual) { setCancionActual(null); return true; }
      if (himnarioActual) { setHimnarioActual(null); setVerSoloFavoritos(false); setBusqueda(''); setTituloMoviendo(null); return true; }
      return false; 
    };
    const manejadorRetroceso = BackHandler.addEventListener('hardwareBackPress', accionRetroceso);
    return () => manejadorRetroceso.remove();
  }, [cancionActual, himnarioActual]);

  useEffect(() => {
    const cargarFavoritos = async () => {
      try {
        const favsGuardados = await AsyncStorage.getItem('favoritosLocales');
        if (favsGuardados) setFavoritos(JSON.parse(favsGuardados));
      } catch (error) { console.log("Error al cargar favoritos", error); }
    };
    cargarFavoritos();
  }, []);

  useEffect(() => {
    setCargando(true);
    try {
      const unsubscribe = onSnapshot(collection(db, 'himnarios'), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHimnarios(data);
        if (himnarioActual) {
          const actualizado = data.find(h => h.id === himnarioActual.id);
          if (actualizado) setHimnarioActual(actualizado);
        }
        setCargando(false);
      }, (error) => { 
        setCargando(false); 
        setErrorCritico("Error de sincronización con la base de datos.");
      });
      return () => unsubscribe();
    } catch (e) {
      setCargando(false);
      setErrorCritico(e.message);
    }
  }, [himnarioActual?.id]);

  // Al regresar de la canción, hacer scroll automático al índice exacto guardado
  useEffect(() => {
    if (!cancionActual && himnarioActual && flatListRef.current) {
      setTimeout(() => {
        try {
          flatListRef.current.scrollToIndex({ index: indiceUltimaCancion, animated: false });
        } catch (error) {
          // Si el índice excede el filtrado de búsqueda actual, se ignora de forma segura
        }
      }, 150);
    }
  }, [cancionActual]);

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
      Alert.alert("Éxito", "Cambios guardados correctamente.");
    } catch (error) {
      Alert.alert("Error", "No se pudo sincronizar con la base de datos.");
    }
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
            const nuevasCanciones = himnarioActual.canciones.filter((_, i) => i !== indexReal);
            const himnarioActualizado = { ...himnarioActual, canciones: nuevasCanciones };
            setHimnarioActual(himnarioActualizado);
            if (cancionActual) setCancionActual(null);
            
            try {
              await setDoc(doc(db, 'himnarios', himnarioActualizado.id), himnarioActualizado);
              Alert.alert("Eliminado", "La canción ha sido borrada.");
            } catch (error) {
              Alert.alert("Error", "No se pudo eliminar en la base de datos.");
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
        Alert.alert("Éxito", "Logo del coro actualizado correctamente.");
      } catch (error) {
        Alert.alert("Error", "No se pudo actualizar el logo en la base de datos.");
      }
    }
  };

  const seleccionarArchivo = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (resultado.canceled) return;
      subirAlServidor(resultado.assets[0]);
    } catch (error) {
      Alert.alert("Error", "No se pudo seleccionar el archivo.");
    }
  };

  const subirAlServidor = async (archivo) => {
    setCargando(true);
    let tipoArchivo = archivo.mimeType || 'application/octet-stream';
    const nombreOriginal = archivo.name;
    const nombreMinusculas = nombreOriginal.toLowerCase();
    
    if (nombreMinusculas.endsWith('.pdf')) {
      tipoArchivo = 'application/pdf';
    } else if (nombreMinusculas.endsWith('.docx') || nombreMinusculas.endsWith('.doc')) {
      tipoArchivo = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    const tituloLimpio = nombreOriginal.replace(/\.[^/.]+$/, "");

    try {
      const url = 'https://cancionerobackend.onrender.com/procesar-documento/';
      const response = await FileSystem.uploadAsync(url, archivo.uri, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: 1, 
        mimeType: tipoArchivo, 
      });

      const data = JSON.parse(response.body);
      
      if (response.status !== 200) {
        throw new Error(data.detail || `Error del servidor: ${response.status}`);
      }
      
      if (data.canciones) {
        let himnarioGuardar;

        if (himnarioActual) {
          himnarioGuardar = {
            ...himnarioActual,
            canciones: [...himnarioActual.canciones, ...data.canciones]
          };
          setHimnarioActual(himnarioGuardar); 
          Alert.alert("Completado", `Se agregaron ${data.canciones.length} canciones nuevas.`);
        } else {
          himnarioGuardar = {
            id: Date.now().toString(),
            titulo: tituloLimpio,
            logoUrl: "",
            canciones: data.canciones
          };
          Alert.alert("Completado", `Se guardó el himnario "${tituloLimpio}" con ${data.canciones.length} canciones.`);
        }

        await setDoc(doc(db, 'himnarios', himnarioGuardar.id), himnarioGuardar);

      } else {
        Alert.alert("Error de procesamiento", "El servidor no devolvió canciones.");
      }
    } catch (error) {
      Alert.alert("Fallo de conexión", `Detalle: ${error.message}`);
    } finally {
      setCargando(false);
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
        <Text style={{color: '#ff5252', fontSize: 18, textAlign: 'center', marginBottom: 20}}>⚠️ Error al iniciar la app:</Text>
        <Text style={{color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 20}}>{errorCritico}</Text>
        <Button title="Reintentar" color="#03dac6" onPress={() => setErrorCritico(null)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ENCABEZADO */}
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
            {himnarioActual ? himnarioActual.titulo : "Biblioteca"}
          </Text>
        </View>

        <TouchableOpacity onPress={() => modoEdicion ? setModoEdicion(false) : setModalVisible(true)}>
          <Text style={styles.btnDesbloquear}>{modoEdicion ? "🔓 Salir" : "🔒"}</Text>
        </TouchableOpacity>
      </View>
      
      {cargando ? <ActivityIndicator size="large" color="#03dac6" /> : cancionActual ? (
        <View style={styles.vistaCancion}>
          <View style={styles.headerVistaCancion}>
            <TouchableOpacity style={styles.btnVolver} onPress={() => setCancionActual(null)}>
              <Text style={styles.btnVolverTexto}>⬅ Volver</Text>
            </TouchableOpacity>
            
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {modoEdicion && (
                <TouchableOpacity style={[styles.btnZoom, {backgroundColor: '#bb86fc'}]} onPress={() => {
                  const idxReal = himnarioActual.canciones.findIndex(c => c.titulo === cancionActual.titulo);
                  abrirModalCrearOEditar(cancionActual, idxReal);
                }}>
                  <Text style={[styles.btnZoomText, {color: '#000'}]}>✏️ Editar</Text>
                </TouchableOpacity>
              )}
              <View style={styles.zoomContainer}>
                <TouchableOpacity style={styles.btnZoom} onPress={() => setFontSize(prev => Math.max(12, prev - 2))}>
                  <Text style={styles.btnZoomText}>A-</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnZoom} onPress={() => setFontSize(prev => Math.min(32, prev + 2))}>
                  <Text style={styles.btnZoomText}>A+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.tituloCompleto}>{cancionActual.titulo}</Text>
            <Text style={[styles.lineaLetra, { fontSize: fontSize }]}>{cancionActual.letra}</Text>
          </ScrollView>
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
      ) : (
        <FlatList data={himnarios} keyExtractor={(item) => item.id} renderItem={({ item }) => (
          <View style={styles.tarjetaHimnario}>
            <TouchableOpacity style={styles.btnHimnario} onPress={() => { setHimnarioActual(item); setIndiceUltimaCancion(0); }}>
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
                <Text style={[styles.tituloHimnario, {marginLeft: 15}]}>{item.titulo}</Text>
              </View>
            </TouchableOpacity>

            {modoEdicion && (
              <TouchableOpacity style={styles.btnCambiarLogoTarjeta} onPress={() => manejarToqueLogo(item)}>
                <Text style={{color: '#03dac6', fontSize: 12, fontWeight: 'bold'}}>🖼️ Ver / Gestionar</Text>
              </TouchableOpacity>
            )}
          </View>
        )} />
      )}

      {/* BOTÓN FLOTANTE (FAB) */}
      {modoEdicion && !cargando && !cancionActual && (
        <View style={{position: 'absolute', bottom: 45, right: 20, flexDirection: 'row'}}>
          {himnarioActual && (
            <TouchableOpacity style={[styles.fab, {backgroundColor: '#03dac6', marginRight: 10}]} onPress={() => abrirModalCrearOEditar()}>
              <Text style={[styles.fabIcon, {color: '#000'}]}>+ Crear Canción</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.fab} onPress={seleccionarArchivo}>
            <Text style={styles.fabIcon}>
              {himnarioActual ? "+ Subir Archivo" : "+ Nuevo Himnario"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL CREAR O EDITAR CANCIÓN */}
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

      {/* MODAL VER IMAGEN AMPLIADA */}
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

      {/* MODAL GESTIÓN DE LOGO */}
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
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#bb86fc', flex: 1 },
  logoCoro: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#03dac6' },
  logoTarjeta: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 1.5, borderColor: '#03dac6' },
  logoPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#03dac6', borderStyle: 'dashed' },
  btnCambiarLogoTarjeta: { position: 'absolute', right: 15, top: 18, backgroundColor: '#252525', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#03dac6' },
  btnDesbloquear: { fontSize: 20, color: '#03dac6', paddingLeft: 10 },
  tarjetaHimnario: { backgroundColor: '#1e1e1e', borderRadius: 12, marginBottom: 15, justifyContent: 'center' },
  btnHimnario: { padding: 15 },
  tituloHimnario: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1 },
  itemIndice: { flexDirection: 'row', backgroundColor: '#1e1e1e', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center', height: 70 },
  tituloIndice: { color: '#fff', fontSize: 18, flex: 1 },
  inputBusqueda: { backgroundColor: '#1e1e1e', color: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, fontSize: 16 },
  btnVolver: { padding: 10, backgroundColor: '#333', borderRadius: 8, alignSelf: 'flex-start' },
  btnVolverTexto: { color: '#03dac6', fontWeight: 'bold' },
  vistaCancion: { flex: 1, marginTop: 10 },
  headerVistaCancion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  zoomContainer: { flexDirection: 'row' },
  btnZoom: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginLeft: 8 },
  btnZoomText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  tituloCompleto: { fontSize: 24, color: '#bb86fc', textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  lineaLetra: { color: '#ccc', textAlign: 'center', lineHeight: 28 },
  fab: { backgroundColor: '#bb86fc', padding: 15, borderRadius: 30, elevation: 5 },
  fabIcon: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20 },
  modalOverlayVisor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  btnCerrarVisor: { position: 'absolute', top: 40, right: 20, backgroundColor: '#333', padding: 10, borderRadius: 8, zIndex: 10 },
  imagenCompleta: { width: '90%', height: '80%' },
  modalView: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 10, alignItems: 'center', width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  inputClave: { width: '100%', backgroundColor: '#333', color: '#fff', padding: 12, marginBottom: 15, borderRadius: 5, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' }
});