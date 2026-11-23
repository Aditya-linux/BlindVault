/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/blind_vault.json`.
 */
export type BlindVault = {
  "address": "E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h",
  "metadata": {
    "name": "blindVault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Blind Vault — Storage Wars on Solana with MagicBlock PER + VRF"
  },
  "instructions": [
    {
      "name": "addItem",
      "discriminator": [
        225,
        38,
        79,
        147,
        116,
        142,
        147,
        57
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "item",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  116,
                  101,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "index"
              }
            ]
          }
        },
        {
          "name": "itemMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "poolAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "house"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "itemMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u16"
        },
        {
          "name": "rarity",
          "type": "u8"
        },
        {
          "name": "category",
          "type": "u8"
        },
        {
          "name": "value",
          "type": "u32"
        },
        {
          "name": "name",
          "type": {
            "array": [
              "u8",
              24
            ]
          }
        }
      ]
    },
    {
      "name": "buyPeek",
      "discriminator": [
        155,
        107,
        95,
        156,
        27,
        236,
        203,
        216
      ],
      "accounts": [
        {
          "name": "buyer",
          "signer": true
        },
        {
          "name": "lot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "lot.house",
                "account": "vault"
              },
              {
                "kind": "account",
                "path": "lot.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "contents"
        },
        {
          "name": "poolLedger"
        },
        {
          "name": "peek",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  101,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "lot"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "peekPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "vault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        }
      ],
      "args": []
    },
    {
      "name": "clearReservedItems",
      "docs": [
        "Recover inventory from an abandoned Devnet round without marking it sold."
      ],
      "discriminator": [
        52,
        11,
        194,
        58,
        225,
        234,
        71,
        200
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "poolLedger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  57
                ]
              },
              {
                "kind": "account",
                "path": "house"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "indices",
          "type": {
            "vec": "u16"
          }
        }
      ]
    },
    {
      "name": "closeContentsPermission",
      "docs": [
        "Remove the now-public contents ACL in its own transaction before undelegation."
      ],
      "discriminator": [
        136,
        3,
        80,
        93,
        148,
        183,
        190,
        20
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "hints",
          "writable": true
        },
        {
          "name": "contents",
          "writable": true
        },
        {
          "name": "poolLedger",
          "writable": true
        },
        {
          "name": "contentsPermission",
          "writable": true
        },
        {
          "name": "poolPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closePeek",
      "discriminator": [
        86,
        169,
        11,
        71,
        128,
        152,
        71,
        144
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "Buyer signs CloseEphemeralPermission (ACL member)."
          ],
          "signer": true
        },
        {
          "name": "lot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "lot.house",
                "account": "vault"
              },
              {
                "kind": "account",
                "path": "lot.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "peek",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  101,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "lot"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "peekPermission",
          "writable": true
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "vault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closePeekKeeper",
      "docs": [
        "House authority closes a foreign peek after reveal.",
        "Peek ACL lists the vault PDA as AUTHORITY (same pattern as MB-016 bids),",
        "so the buyer does not need to be online — unblocks abandoned close_round."
      ],
      "discriminator": [
        52,
        90,
        249,
        83,
        255,
        169,
        106,
        147
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "lot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "lot.house",
                "account": "vault"
              },
              {
                "kind": "account",
                "path": "lot.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "buyer"
        },
        {
          "name": "peek",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  101,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "lot"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "peekPermission",
          "writable": true
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "vault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closePoolPermission",
      "docs": [
        "The pool must return to base Solana with the vault so the next round",
        "can delegate a fresh TEE clone instead of reusing an orphaned one."
      ],
      "discriminator": [
        230,
        125,
        210,
        214,
        55,
        223,
        220,
        185
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "hints",
          "writable": true
        },
        {
          "name": "contents",
          "writable": true
        },
        {
          "name": "poolLedger",
          "writable": true
        },
        {
          "name": "contentsPermission",
          "writable": true
        },
        {
          "name": "poolPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closeRound",
      "discriminator": [
        149,
        14,
        81,
        88,
        230,
        226,
        234,
        37
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "hints",
          "writable": true
        },
        {
          "name": "contents",
          "writable": true
        },
        {
          "name": "poolLedger",
          "writable": true
        },
        {
          "name": "contentsPermission",
          "writable": true
        },
        {
          "name": "poolPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "commitClosedRound",
      "docs": [
        "Commit in a separate transaction from the state writes in close_round.",
        "The TEE rejected a MagicIntent CPI when those writes shared its transaction."
      ],
      "discriminator": [
        104,
        63,
        16,
        42,
        31,
        214,
        12,
        242
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "hints",
          "writable": true
        },
        {
          "name": "contents",
          "writable": true
        },
        {
          "name": "poolLedger",
          "writable": true
        },
        {
          "name": "contentsPermission",
          "writable": true
        },
        {
          "name": "poolPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createVault",
      "discriminator": [
        29,
        237,
        247,
        208,
        193,
        82,
        54,
        135
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "house"
              },
              {
                "kind": "account",
                "path": "house.next_vault_id",
                "account": "house"
              }
            ]
          }
        },
        {
          "name": "hints",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  105,
                  110,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "contents",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  101,
                  110,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "scripMint"
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "scripMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "size",
          "type": "u8"
        }
      ]
    },
    {
      "name": "delegateContents",
      "discriminator": [
        188,
        163,
        77,
        50,
        138,
        177,
        8,
        148
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault"
        },
        {
          "name": "bufferContents",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "contents"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                195,
                83,
                248,
                160,
                180,
                31,
                131,
                62,
                237,
                179,
                246,
                36,
                203,
                203,
                255,
                13,
                54,
                223,
                253,
                212,
                162,
                120,
                204,
                143,
                240,
                71,
                241,
                40,
                144,
                106,
                138,
                246
              ]
            }
          }
        },
        {
          "name": "delegationRecordContents",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "contents"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataContents",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "contents"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "contents",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateHints",
      "discriminator": [
        45,
        127,
        96,
        194,
        163,
        84,
        233,
        57
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault"
        },
        {
          "name": "bufferHints",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "hints"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                195,
                83,
                248,
                160,
                180,
                31,
                131,
                62,
                237,
                179,
                246,
                36,
                203,
                203,
                255,
                13,
                54,
                223,
                253,
                212,
                162,
                120,
                204,
                143,
                240,
                71,
                241,
                40,
                144,
                106,
                138,
                246
              ]
            }
          }
        },
        {
          "name": "delegationRecordHints",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "hints"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataHints",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "hints"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "hints",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegatePoolLedger",
      "discriminator": [
        94,
        27,
        73,
        162,
        19,
        243,
        145,
        189
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault"
        },
        {
          "name": "bufferPoolLedger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "poolLedger"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                195,
                83,
                248,
                160,
                180,
                31,
                131,
                62,
                237,
                179,
                246,
                36,
                203,
                203,
                255,
                13,
                54,
                223,
                253,
                212,
                162,
                120,
                204,
                143,
                240,
                71,
                241,
                40,
                144,
                106,
                138,
                246
              ]
            }
          }
        },
        {
          "name": "delegationRecordPoolLedger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "poolLedger"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPoolLedger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "poolLedger"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "poolLedger",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateVault",
      "docs": [
        "Delegate Vault PDA. Client also delegates hints/contents/pool via sibling ixs."
      ],
      "discriminator": [
        166,
        89,
        17,
        247,
        90,
        45,
        115,
        224
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "bufferVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                195,
                83,
                248,
                160,
                180,
                31,
                131,
                62,
                237,
                179,
                246,
                36,
                203,
                203,
                255,
                13,
                54,
                223,
                253,
                212,
                162,
                120,
                204,
                143,
                240,
                71,
                241,
                40,
                144,
                106,
                138,
                246
              ]
            }
          }
        },
        {
          "name": "delegationRecordVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "endAuction",
      "discriminator": [
        252,
        110,
        101,
        234,
        66,
        104,
        28,
        87
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "faucet",
      "discriminator": [
        0,
        98,
        59,
        30,
        144,
        142,
        113,
        12
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "scripMint",
          "writable": true
        },
        {
          "name": "userScripAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "scripMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "faucetTicket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  117,
                  99,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": []
    },
    {
      "name": "fillVault",
      "docs": [
        "Fill vault using TEE-local entropy mix (Day-1 VRF spike fallback §7.5 / R1).",
        "Production path swaps in ER VRF callback once verified on devnet-tee."
      ],
      "discriminator": [
        207,
        10,
        24,
        50,
        84,
        6,
        98,
        67
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "hints",
          "writable": true
        },
        {
          "name": "contents",
          "writable": true
        },
        {
          "name": "poolLedger",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "clientSeed",
          "type": "u8"
        }
      ]
    },
    {
      "name": "finalize",
      "discriminator": [
        171,
        61,
        218,
        56,
        127,
        115,
        12,
        217
      ],
      "accounts": [
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "contents"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "finalizeAbandoned",
      "discriminator": [
        110,
        168,
        87,
        95,
        187,
        216,
        188,
        42
      ],
      "accounts": [
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "forceAbandonStale",
      "docs": [
        "House escape hatch after deadline + grace when private bids block `end_auction`.",
        "Marks the lot abandoned and treats bids/peeks as closed so settlement can finish",
        "and a new Open lot can start (Devnet faucet SCRIP — not real funds)."
      ],
      "discriminator": [
        200,
        176,
        99,
        152,
        233,
        165,
        239,
        154
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house"
        },
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "forceClearActive",
      "docs": [
        "Clear `house.active_vault` so a new lot can open when the prior round is stuck",
        "mid-settlement on TEE (Devnet/demo escape hatch)."
      ],
      "discriminator": [
        46,
        16,
        138,
        34,
        169,
        42,
        36,
        204
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault"
        }
      ],
      "args": []
    },
    {
      "name": "initBidPermission",
      "discriminator": [
        36,
        217,
        208,
        192,
        111,
        156,
        135,
        147
      ],
      "accounts": [
        {
          "name": "bidder",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.house",
                "account": "vault"
              },
              {
                "kind": "account",
                "path": "vault.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "bid",
          "writable": true
        },
        {
          "name": "bidPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        }
      ],
      "args": []
    },
    {
      "name": "initContentsPermission",
      "docs": [
        "Create contents permission only (isolates pool ghost failures)."
      ],
      "discriminator": [
        173,
        33,
        68,
        164,
        11,
        75,
        120,
        253
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "contents",
          "writable": true
        },
        {
          "name": "contentsPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initHouse",
      "discriminator": [
        179,
        199,
        91,
        87,
        163,
        192,
        163,
        183
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "scripMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "house"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "scripMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "peekFee",
          "type": {
            "array": [
              "u64",
              3
            ]
          }
        },
        {
          "name": "minBid",
          "type": {
            "array": [
              "u64",
              3
            ]
          }
        },
        {
          "name": "durationSecs",
          "type": {
            "array": [
              "i64",
              3
            ]
          }
        }
      ]
    },
    {
      "name": "initPermissions",
      "discriminator": [
        247,
        240,
        133,
        29,
        26,
        176,
        185,
        61
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "contents",
          "writable": true
        },
        {
          "name": "poolLedger",
          "writable": true
        },
        {
          "name": "contentsPermission",
          "writable": true
        },
        {
          "name": "poolPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initPoolLedger",
      "discriminator": [
        108,
        176,
        45,
        29,
        80,
        226,
        4,
        227
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "poolLedger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  57
                ]
              },
              {
                "kind": "account",
                "path": "house"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initPoolPermission",
      "docs": [
        "Create pool permission with the house PDA as standing member so later",
        "rounds can Update without the previous vault still being on the TEE."
      ],
      "discriminator": [
        110,
        253,
        10,
        13,
        34,
        190,
        42,
        184
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "poolLedger",
          "writable": true
        },
        {
          "name": "poolPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initVaultEscrowEata",
      "docs": [
        "Create (+ optionally delegate) the vault SCRIP eATA after `create_vault`."
      ],
      "discriminator": [
        34,
        251,
        247,
        184,
        199,
        60,
        168,
        89
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.house",
                "account": "vault"
              },
              {
                "kind": "account",
                "path": "vault.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "scripMint"
        },
        {
          "name": "escrowEata",
          "writable": true
        },
        {
          "name": "escrowEataBuffer",
          "writable": true
        },
        {
          "name": "escrowEataRecord",
          "writable": true
        },
        {
          "name": "escrowEataMetadata",
          "writable": true
        },
        {
          "name": "ephemeralTokenProgram",
          "address": "SPLxh1LVZzEkX99H6rqYizhytLWPZVV296zyYDPagv2"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "doDelegate",
          "type": "bool"
        }
      ]
    },
    {
      "name": "payWinningBid",
      "docs": [
        "Winner pays on base Solana after reveal. The TEE cannot write the",
        "house treasury ATA, so its settle instruction verifies this receipt."
      ],
      "discriminator": [
        88,
        225,
        40,
        60,
        238,
        33,
        44,
        114
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault"
        },
        {
          "name": "paymentReceipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payerScrip",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "placeBid",
      "discriminator": [
        238,
        77,
        148,
        91,
        200,
        151,
        92,
        146
      ],
      "accounts": [
        {
          "name": "bidder",
          "signer": true
        },
        {
          "name": "lot",
          "docs": [
            "Auction vault PDA (must NOT be named `vault` — macro reserves that for Magic rent vault)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "lot.house",
                "account": "vault"
              },
              {
                "kind": "account",
                "path": "lot.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "bid",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "lot"
              },
              {
                "kind": "account",
                "path": "bidder"
              }
            ]
          }
        },
        {
          "name": "bidderScrip",
          "docs": [
            "Bidder SCRIP ATA (canonical ATA on TEE after delegateSpl). Funds locked via approve."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "vault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "baseAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62
              ]
            }
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "publishHint",
      "discriminator": [
        180,
        244,
        208,
        17,
        204,
        50,
        240,
        58
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "hints",
          "writable": true
        },
        {
          "name": "contents"
        },
        {
          "name": "poolLedger"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "refundBid",
      "discriminator": [
        171,
        145,
        79,
        190,
        16,
        50,
        10,
        24
      ],
      "accounts": [
        {
          "name": "bidder",
          "docs": [
            "Bidder signs CloseEphemeralPermission (ACL member)."
          ],
          "signer": true
        },
        {
          "name": "lot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "lot.house",
                "account": "vault"
              },
              {
                "kind": "account",
                "path": "lot.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "bid",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "lot"
              },
              {
                "kind": "account",
                "path": "bidder"
              }
            ]
          }
        },
        {
          "name": "bidPermission",
          "writable": true
        },
        {
          "name": "escrow",
          "docs": [
            "Vault escrow ATA"
          ],
          "writable": true
        },
        {
          "name": "bidderScrip",
          "docs": [
            "Bidder SCRIP ATA"
          ],
          "writable": true
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "vault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "releasePoolItems",
      "docs": [
        "TEE-only: mark pool items sold / clear reserved after a round already closed",
        "without pool bit updates (pool stays delegated — MB-015 lifecycle)."
      ],
      "discriminator": [
        161,
        191,
        99,
        148,
        108,
        117,
        150,
        23
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "poolLedger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  57
                ]
              },
              {
                "kind": "account",
                "path": "house"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "indices",
          "type": {
            "vec": "u16"
          }
        }
      ]
    },
    {
      "name": "revealContents",
      "discriminator": [
        21,
        139,
        75,
        86,
        97,
        64,
        116,
        246
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "contents",
          "writable": true
        },
        {
          "name": "poolLedger",
          "writable": true
        },
        {
          "name": "contentsPermission",
          "writable": true
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        }
      ],
      "args": []
    },
    {
      "name": "settleWinningBid",
      "discriminator": [
        115,
        0,
        25,
        200,
        102,
        198,
        12,
        95
      ],
      "accounts": [
        {
          "name": "closer",
          "docs": [
            "Winner signs CloseEphemeralPermission (bid ACL member per MB-016)."
          ],
          "signer": true
        },
        {
          "name": "lot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "lot.house",
                "account": "vault"
              },
              {
                "kind": "account",
                "path": "lot.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "bid",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "lot"
              },
              {
                "kind": "account",
                "path": "lot.winner",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "bidPermission",
          "writable": true
        },
        {
          "name": "paymentReceipt",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "lot"
              },
              {
                "kind": "account",
                "path": "lot.winner",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "Winner SCRIP ATA (bid.escrow) — vault is SPL delegate from place_bid"
          ],
          "writable": true
        },
        {
          "name": "treasury"
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "vault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "touchAccount",
      "docs": [
        "No-op that forces the TEE to clone a delegated account (e.g. pool after re-delegate)."
      ],
      "discriminator": [
        60,
        30,
        223,
        215,
        15,
        51,
        227,
        197
      ],
      "accounts": [
        {
          "name": "account",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "updateHouseTiming",
      "discriminator": [
        0,
        93,
        9,
        145,
        138,
        193,
        167,
        53
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "house",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "peekFee",
          "type": {
            "array": [
              "u64",
              3
            ]
          }
        },
        {
          "name": "minBid",
          "type": {
            "array": [
              "u64",
              3
            ]
          }
        },
        {
          "name": "durationSecs",
          "type": {
            "array": [
              "i64",
              3
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "faucetTicket",
      "discriminator": [
        109,
        251,
        58,
        53,
        201,
        168,
        242,
        87
      ]
    },
    {
      "name": "house",
      "discriminator": [
        21,
        145,
        94,
        109,
        254,
        199,
        210,
        151
      ]
    },
    {
      "name": "item",
      "discriminator": [
        92,
        157,
        163,
        130,
        72,
        254,
        86,
        216
      ]
    },
    {
      "name": "paymentReceipt",
      "discriminator": [
        168,
        198,
        209,
        4,
        60,
        235,
        126,
        109
      ]
    },
    {
      "name": "poolLedger",
      "discriminator": [
        157,
        75,
        200,
        36,
        138,
        39,
        229,
        193
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    },
    {
      "name": "vaultContents",
      "discriminator": [
        158,
        26,
        167,
        179,
        127,
        35,
        183,
        116
      ]
    },
    {
      "name": "vaultHints",
      "discriminator": [
        97,
        58,
        50,
        16,
        98,
        92,
        56,
        99
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "invalidSize",
      "msg": "Invalid vault size"
    },
    {
      "code": 6002,
      "name": "invalidRarity",
      "msg": "Invalid rarity"
    },
    {
      "code": 6003,
      "name": "invalidCategory",
      "msg": "Invalid category"
    },
    {
      "code": 6004,
      "name": "poolFull",
      "msg": "Item pool is full"
    },
    {
      "code": 6005,
      "name": "missingItem",
      "msg": "Missing item account"
    },
    {
      "code": 6006,
      "name": "notEnoughItems",
      "msg": "Not enough free items for this vault"
    },
    {
      "code": 6007,
      "name": "vaultAlreadyActive",
      "msg": "A vault is already active"
    },
    {
      "code": 6008,
      "name": "badStatus",
      "msg": "Bad vault status for this instruction"
    },
    {
      "code": 6009,
      "name": "invalidQueue",
      "msg": "Invalid VRF queue"
    },
    {
      "code": 6010,
      "name": "alreadyFilled",
      "msg": "Vault already filled"
    },
    {
      "code": 6011,
      "name": "hintNotDue",
      "msg": "Hint is not due yet"
    },
    {
      "code": 6012,
      "name": "hintAlreadyReleased",
      "msg": "Hint already released"
    },
    {
      "code": 6013,
      "name": "invalidHint",
      "msg": "Invalid hint index or kind"
    },
    {
      "code": 6014,
      "name": "auctionClosed",
      "msg": "Auction is closed"
    },
    {
      "code": 6015,
      "name": "auctionStillOpen",
      "msg": "Auction is still open"
    },
    {
      "code": 6016,
      "name": "tooManyBidders",
      "msg": "Too many bidders"
    },
    {
      "code": 6017,
      "name": "bidBelowMinimum",
      "msg": "Bid below minimum"
    },
    {
      "code": 6018,
      "name": "alreadyBid",
      "msg": "Already bid on this vault"
    },
    {
      "code": 6019,
      "name": "alreadyPeeked",
      "msg": "Already peeked this vault"
    },
    {
      "code": 6020,
      "name": "insufficientFunds",
      "msg": "Insufficient funds"
    },
    {
      "code": 6021,
      "name": "missingBid",
      "msg": "Missing bid account"
    },
    {
      "code": 6022,
      "name": "invalidBid",
      "msg": "Invalid bid account"
    },
    {
      "code": 6023,
      "name": "invalidBidEscrow",
      "msg": "Invalid bid escrow"
    },
    {
      "code": 6024,
      "name": "duplicateBid",
      "msg": "Duplicate bid"
    },
    {
      "code": 6025,
      "name": "wrongRefundAccount",
      "msg": "Wrong refund account"
    },
    {
      "code": 6026,
      "name": "alreadyRevealed",
      "msg": "Contents already revealed"
    },
    {
      "code": 6027,
      "name": "unclosedBids",
      "msg": "Not all bids closed"
    },
    {
      "code": 6028,
      "name": "unclosedPeeks",
      "msg": "Not all peeks closed"
    },
    {
      "code": 6029,
      "name": "unclosedPermission",
      "msg": "Ephemeral permissions must close before commit"
    },
    {
      "code": 6030,
      "name": "notUndelegated",
      "msg": "Vault not undelegated yet"
    },
    {
      "code": 6031,
      "name": "itemMismatch",
      "msg": "Item mismatch on finalize"
    },
    {
      "code": 6032,
      "name": "faucetCooldown",
      "msg": "Faucet cooldown active"
    },
    {
      "code": 6033,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6034,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6035,
      "name": "mintMismatch",
      "msg": "Mint mismatch"
    },
    {
      "code": 6036,
      "name": "invalidTokenOwner",
      "msg": "Invalid token owner"
    }
  ],
  "types": [
    {
      "name": "faucetTicket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "lastClaimTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "hint",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "released",
            "type": "bool"
          },
          {
            "name": "a",
            "type": "u32"
          },
          {
            "name": "b",
            "type": "u32"
          },
          {
            "name": "releasedTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "house",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "scripMint",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "itemCount",
            "type": "u16"
          },
          {
            "name": "nextVaultId",
            "type": "u64"
          },
          {
            "name": "activeVault",
            "type": "pubkey"
          },
          {
            "name": "peekFee",
            "type": {
              "array": [
                "u64",
                3
              ]
            }
          },
          {
            "name": "minBid",
            "type": {
              "array": [
                "u64",
                3
              ]
            }
          },
          {
            "name": "durationSecs",
            "type": {
              "array": [
                "i64",
                3
              ]
            }
          },
          {
            "name": "consignFeeBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "item",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "house",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u16"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "rarity",
            "type": "u8"
          },
          {
            "name": "category",
            "type": "u8"
          },
          {
            "name": "value",
            "type": "u32"
          },
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                24
              ]
            }
          },
          {
            "name": "sold",
            "type": "bool"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "paymentReceipt",
      "docs": [
        "Base Solana proof that the winner paid SCRIP into the house treasury."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "poolLedger",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "house",
            "type": "pubkey"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "sold",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "itemCount",
            "type": "u16"
          },
          {
            "name": "values",
            "type": {
              "array": [
                "u32",
                64
              ]
            }
          },
          {
            "name": "rarities",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "categories",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "house",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "size",
            "type": "u8"
          },
          {
            "name": "itemCount",
            "type": "u8"
          },
          {
            "name": "minBid",
            "type": "u64"
          },
          {
            "name": "peekFee",
            "type": "u64"
          },
          {
            "name": "durationSecs",
            "type": "i64"
          },
          {
            "name": "openTs",
            "type": "i64"
          },
          {
            "name": "deadlineTs",
            "type": "i64"
          },
          {
            "name": "hintTimes",
            "type": {
              "array": [
                "i64",
                4
              ]
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "vaultStatus"
              }
            }
          },
          {
            "name": "bidCount",
            "type": "u8"
          },
          {
            "name": "closedBidCount",
            "type": "u8"
          },
          {
            "name": "peeksSold",
            "type": "u8"
          },
          {
            "name": "closedPeekCount",
            "type": "u8"
          },
          {
            "name": "highestBid",
            "type": "u64"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "winnerIndex",
            "type": "u8"
          },
          {
            "name": "revealedItems",
            "type": {
              "array": [
                "u16",
                8
              ]
            }
          },
          {
            "name": "revealedValue",
            "type": "u32"
          },
          {
            "name": "vrfRequestSlot",
            "type": "u64"
          },
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "abandoned",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultContents",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "items",
            "type": {
              "array": [
                "u16",
                8
              ]
            }
          },
          {
            "name": "len",
            "type": "u8"
          },
          {
            "name": "totalValue",
            "type": "u32"
          },
          {
            "name": "seed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "filled",
            "type": "bool"
          },
          {
            "name": "revealed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultHints",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "hints",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "hint"
                  }
                },
                4
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "created"
          },
          {
            "name": "delegated"
          },
          {
            "name": "filling"
          },
          {
            "name": "open"
          },
          {
            "name": "ended"
          },
          {
            "name": "revealed"
          },
          {
            "name": "abandoned"
          },
          {
            "name": "closed"
          },
          {
            "name": "settled"
          }
        ]
      }
    }
  ]
};
