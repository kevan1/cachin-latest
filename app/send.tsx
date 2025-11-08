import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { searchUsersByUsername } from '@/services/firestoreService';
import type { UserData } from '@/services/firestoreService';

interface Contact {
  id: string;
  name: string;
  username: string;
  verified?: boolean;
  avatarColor: string;
  initials: string;
}

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Pre-fill search text if username is provided from QR scan
  useEffect(() => {
    if (params.username && typeof params.username === 'string') {
      setSearchText(params.username);
    }
  }, [params.username]);

  const recentContacts: Contact[] = [
    {
      id: '1',
      name: 'justy',
      username: '@justy',
      avatarColor: '#FFB380',
      initials: 'JU'
    },
    {
      id: '2',
      name: 'Jota',
      username: '@jota',
      verified: true,
      avatarColor: '#FFB380',
      initials: 'JO'
    },
    {
      id: '3',
      name: 'falvarenga',
      username: '@falvarenga',
      avatarColor: '#FFD966',
      initials: 'FA'
    }
  ];

  const handleBack = () => {
    router.back();
  };

  const handleSelectContact = (contact: Contact) => {
    router.push({
      pathname: '/send-amount',
      params: { recipient: contact.name, address: contact.username }
    });
  };

  // Search users as the user types
  useEffect(() => {
    const searchUsers = async () => {
      if (searchText.length >= 3) {
        setIsSearching(true);
        try {
          const results = await searchUsersByUsername(searchText);
          setSearchResults(results);
        } catch (error) {
          console.error('Error searching users:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchText]);

  const handleSelectUser = (user: UserData) => {
    router.push({
      pathname: '/send-amount',
      params: { 
        recipient: user.username, 
        address: user.solanaAddress 
      }
    });
  };

  const handleAddressSubmit = () => {
    if (searchText.trim().length > 0) {
      // Navigate to send amount screen with the address
      router.push({
        pathname: '/send-amount',
        params: { recipient: searchText, address: searchText }
      });
    }
  };

  const handlePayWithLink = () => {
    console.log('Pay with link');
    // Handle pay with link functionality
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Send</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, username or address"
          placeholderTextColor="#999999"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleAddressSubmit}
          returnKeyType="send"
        />
        {isSearching && (
          <ActivityIndicator size="small" color="#000000" />
        )}
      </View>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search results</Text>
          
          <View style={styles.contactsList}>
            {searchResults.map((user, index) => (
              <TouchableOpacity
                key={user.solanaAddress}
                style={styles.contactItem}
                onPress={() => handleSelectUser(user)}
              >
                <View style={styles.contactLeft}>
                  <View style={[styles.avatar, { backgroundColor: '#FFB380' }]}>
                    <Text style={styles.avatarText}>
                      {user.username.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.contactName}>{user.username}</Text>
                      <Text style={styles.verifiedBadge}>✓</Text>
                    </View>
                    <Text style={styles.contactUsername}>
                      {user.solanaAddress.slice(0, 6)}...{user.solanaAddress.slice(-4)}
                    </Text>
                  </View>
                </View>
                <View style={styles.arrowButton}>
                  <Text style={styles.arrowIcon}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent transactions</Text>
        
        <View style={styles.contactsList}>
          {recentContacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={styles.contactItem}
              onPress={() => handleSelectContact(contact)}
            >
              <View style={styles.contactLeft}>
                <View style={[styles.avatar, { backgroundColor: contact.avatarColor }]}>
                  <Text style={styles.avatarText}>{contact.initials}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.verified && (
                      <Text style={styles.verifiedBadge}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.contactUsername}>{contact.username}</Text>
                </View>
              </View>
              <View style={styles.arrowButton}>
                <Text style={styles.arrowIcon}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Divider */}
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Pay with Link Button */}
      <TouchableOpacity style={styles.linkButton} onPress={handlePayWithLink}>
        <Text style={styles.linkIcon}>🔗</Text>
        <Text style={styles.linkButtonText}>Pay anyone with a link!</Text>
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <Text style={styles.infoIcon}>ⓘ</Text>
        <Text style={styles.infoText}>Works even if they don&apos;t use Peanut!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 30,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 50,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 30,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
  },
  contactsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  contactInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  verifiedBadge: {
    fontSize: 16,
    color: '#10b981',
  },
  contactUsername: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#60A5FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#CCCCCC',
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 16,
    color: '#666666',
  },
  linkButton: {
    flexDirection: 'row',
    backgroundColor: '#60A5FA',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  linkIcon: {
    fontSize: 24,
  },
  linkButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    gap: 5,
  },
  infoIcon: {
    fontSize: 16,
    color: '#666666',
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
  },
});
