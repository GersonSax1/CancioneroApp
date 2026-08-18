import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Button, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export default function App() {
  const [canciones, setCanciones] = useState([]);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [claveEntrada, setClaveEntrada] = useState('');
  const [cargando, setCargando] = useState(false);

  const CLAVE_SECRETA = "alabanza2026"; 

  const intentarDesbloquear = () => {
    if (claveEntrada === CLAVE_SECRETA) {
      setModoEdicion(true);
      setModalVisible(false);
      setClaveEntrada('');
      Alert.alert("Desbloqueado", "Modo administrador activado.");
    } else {
      Alert.alert("Denegado", "Contraseña incorrecta.");
      setClaveEntrada('');
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
    const formData = new FormData();
    formData.append('file', {
      uri: archivo.uri,
      name: archivo.name,
      type: archivo.mimeType || 'application/octet-stream',
    });

    try {
      // AQUÍ PONES LA IP QUE ANOTASTE DEL IPCONFIG
      const url = 'https://cancionerobackend.onrender.com/procesar-documento/';
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = await response.json();
      
      if (data.canciones) {
        setCanciones(data.canciones);
        Alert.alert("Completado", `Se generó el cancionero con ${data.canciones.length} canciones.`);
      } else {
        Alert.alert("Error", data.detail || "Error desconocido.");
      }
    } catch (error) {
      Alert.alert("Error de conexión", "Revisa que tu celular esté en el mismo WiFi y la IP esté correcta en App.js.");
      console.log(error);
    } finally {
      setCargando(false);
    }
  };

  const renderCancion = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.titulo}>{item.titulo}</Text>
      <Text style={styles.letra}>{item.letra}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>Cancionero App</Text>
        {!modoEdicion ? (
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Text style={styles.btnDesbloquear}>🔒</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setModoEdicion(false)}>
            <Text style={styles.btnDesbloquear}>🔓 Salir</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {cargando ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#03dac6" />
          <Text style={styles.emptyTextSub}>Procesando documento...</Text>
        </View>
      ) : canciones.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>Cancionero vacío.</Text>
          {modoEdicion && <Text style={styles.emptyTextSub}>Carga un .DOCX o .PDF para comenzar</Text>}
        </View>
      ) : (
        <FlatList
          data={canciones}
          keyExtractor={item => item.id}
          renderItem={renderCancion}
        />
      )}

      {modoEdicion && !cargando && (
        <TouchableOpacity style={styles.fab} onPress={seleccionarArchivo}>
          <Text style={styles.fabIcon}>+ Subir Archivo</Text>
        </TouchableOpacity>
      )}

      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Ingresar Contraseña</Text>
            <TextInput
              style={styles.inputClave}
              secureTextEntry={true}
              placeholder="Escribe la clave..."
              placeholderTextColor="#888"
              value={claveEntrada}
              onChangeText={setClaveEntrada}
            />
            <View style={styles.modalButtons}>
              <Button title="Cancelar" color="#ff5252" onPress={() => setModalVisible(false)} />
              <Button title="Desbloquear" color="#03dac6" onPress={intentarDesbloquear} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#bb86fc' },
  btnDesbloquear: { fontSize: 20, color: '#03dac6' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 18 },
  emptyTextSub: { color: '#555', fontSize: 14, marginTop: 10 },
  card: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 10, marginBottom: 15 },
  titulo: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 5 },
  letra: { color: '#aaaaaa', lineHeight: 22, fontSize: 16 },
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#bb86fc', padding: 15, borderRadius: 30, elevation: 5 },
  fabIcon: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20 },
  modalView: { backgroundColor: '#1e1e1e', borderRadius: 10, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  inputClave: { width: '100%', backgroundColor: '#2c2c2c', color: '#fff', padding: 10, borderRadius: 5, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' }
});