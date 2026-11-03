from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.token_scope import TokenScope
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="TokenInfo")



@_attrs_define
class TokenInfo:
    """ 
        Attributes:
            id (UUID):
            name (str):
            prefix (str):
            scopes (list[TokenScope]):
            created_at (datetime.datetime):
            expires_at (datetime.datetime):
            last_used_at (datetime.datetime | None):
     """

    id: UUID
    name: str
    prefix: str
    scopes: list[TokenScope]
    created_at: datetime.datetime
    expires_at: datetime.datetime
    last_used_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        prefix = self.prefix

        scopes = []
        for scopes_item_data in self.scopes:
            scopes_item = scopes_item_data.value
            scopes.append(scopes_item)



        created_at = self.created_at.isoformat()

        expires_at = self.expires_at.isoformat()

        last_used_at: None | str
        if isinstance(self.last_used_at, datetime.datetime):
            last_used_at = self.last_used_at.isoformat()
        else:
            last_used_at = self.last_used_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "prefix": prefix,
            "scopes": scopes,
            "createdAt": created_at,
            "expiresAt": expires_at,
            "lastUsedAt": last_used_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        prefix = d.pop("prefix")

        scopes = []
        _scopes = d.pop("scopes")
        for scopes_item_data in (_scopes):
            scopes_item = TokenScope(scopes_item_data)



            scopes.append(scopes_item)


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        expires_at = datetime.datetime.fromisoformat(d.pop("expiresAt"))




        def _parse_last_used_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_used_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_used_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_used_at = _parse_last_used_at(d.pop("lastUsedAt"))


        token_info = cls(
            id=id,
            name=name,
            prefix=prefix,
            scopes=scopes,
            created_at=created_at,
            expires_at=expires_at,
            last_used_at=last_used_at,
        )

        return token_info

