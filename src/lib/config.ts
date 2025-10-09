import { prisma } from './prisma';

/**
 * Configuration management utility
 * Handles reading and writing system configuration values
 */

export interface ConfigValue {
  key: string;
  value: string;
  description?: string;
  category: string;
}

/**
 * Get a configuration value by key
 */
export async function getConfig(key: string, defaultValue?: string): Promise<string | null> {
  try {
    const config = await prisma.config.findUnique({
      where: { key }
    });
    
    return config?.value || defaultValue || null;
  } catch (error) {
    console.error(`Error getting config for key "${key}":`, error);
    return defaultValue || null;
  }
}

/**
 * Get a boolean configuration value
 */
export async function getConfigBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
  const value = await getConfig(key, defaultValue.toString());
  if (value === null) return defaultValue;
  
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get a numeric configuration value
 */
export async function getConfigNumber(key: string, defaultValue: number = 0): Promise<number> {
  const value = await getConfig(key, defaultValue.toString());
  if (value === null) return defaultValue;
  
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Set a configuration value
 */
export async function setConfig(key: string, value: string, description?: string, category: string = 'GENERAL'): Promise<void> {
  try {
    await prisma.config.upsert({
      where: { key },
      update: { 
        value, 
        description: description || undefined,
        category,
        updatedAt: new Date()
      },
      create: { 
        key, 
        value, 
        description: description || undefined,
        category
      }
    });
  } catch (error) {
    console.error(`Error setting config for key "${key}":`, error);
    throw error;
  }
}

/**
 * Get all configuration values by category
 */
export async function getConfigByCategory(category: string): Promise<ConfigValue[]> {
  try {
    const configs = await prisma.config.findMany({
      where: { category },
      orderBy: { key: 'asc' }
    });
    
    return configs.map(config => ({
      key: config.key,
      value: config.value,
      description: config.description || undefined,
      category: config.category
    }));
  } catch (error) {
    console.error(`Error getting configs for category "${category}":`, error);
    return [];
  }
}

/**
 * Get all configuration values
 */
export async function getAllConfigs(): Promise<ConfigValue[]> {
  try {
    const configs = await prisma.config.findMany({
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    });
    
    return configs.map(config => ({
      key: config.key,
      value: config.value,
      description: config.description || undefined,
      category: config.category
    }));
  } catch (error) {
    console.error('Error getting all configs:', error);
    return [];
  }
}

/**
 * Delete a configuration value
 */
export async function deleteConfig(key: string): Promise<void> {
  try {
    await prisma.config.delete({
      where: { key }
    });
  } catch (error) {
    console.error(`Error deleting config for key "${key}":`, error);
    throw error;
  }
}

/**
 * Initialize default configuration values
 */
export async function initializeDefaultConfigs(): Promise<void> {
  const defaultConfigs = [
    {
      key: 'email.match_scheduled.enabled',
      value: 'true',
      description: 'Enable/disable match scheduled email notifications',
      category: 'EMAIL'
    },
    {
      key: 'email.game_reminders.enabled',
      value: 'true',
      description: 'Enable/disable game reminder email notifications',
      category: 'EMAIL'
    },
    {
      key: 'email.team_join.enabled',
      value: 'true',
      description: 'Enable/disable team join email notifications',
      category: 'EMAIL'
    },
    {
      key: 'email.welcome.enabled',
      value: 'true',
      description: 'Enable/disable welcome email notifications',
      category: 'EMAIL'
    },
    {
      key: 'email.password_reset.enabled',
      value: 'true',
      description: 'Enable/disable password reset email notifications',
      category: 'EMAIL'
    }
  ];

  for (const config of defaultConfigs) {
    try {
      // Only create if it doesn't exist
      const existing = await prisma.config.findUnique({
        where: { key: config.key }
      });
      
      if (!existing) {
        await prisma.config.create({
          data: config
        });
        console.log(`✅ Created default config: ${config.key} = ${config.value}`);
      }
    } catch (error) {
      console.error(`Error creating default config ${config.key}:`, error);
    }
  }
}

// Email-specific configuration helpers
export const EmailConfig = {
  /**
   * Check if match scheduled emails are enabled
   */
  async isMatchScheduledEnabled(): Promise<boolean> {
    return await getConfigBoolean('email.match_scheduled.enabled', true);
  },

  /**
   * Check if game reminder emails are enabled
   */
  async isGameRemindersEnabled(): Promise<boolean> {
    return await getConfigBoolean('email.game_reminders.enabled', true);
  },

  /**
   * Check if team join emails are enabled
   */
  async isTeamJoinEnabled(): Promise<boolean> {
    return await getConfigBoolean('email.team_join.enabled', true);
  },

  /**
   * Check if welcome emails are enabled
   */
  async isWelcomeEnabled(): Promise<boolean> {
    return await getConfigBoolean('email.welcome.enabled', true);
  },

  /**
   * Check if password reset emails are enabled
   */
  async isPasswordResetEnabled(): Promise<boolean> {
    return await getConfigBoolean('email.password_reset.enabled', true);
  }
};