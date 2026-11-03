from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ScimToken")



@_attrs_define
class ScimToken:
    """ 
        Attributes:
            id (UUID):
            name (str):
            prefix (str):
            created_at (datetime.datetime):
            last_used_at (datetime.datetime | None):
     """

    id: UUID
    name: str
    prefix: str
    created_at: datetime.datetime
    last_used_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        prefix = self.prefix

        created_at = self.created_at.isoformat()

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
            "createdAt": created_at,
            "lastUsedAt": last_used_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        prefix = d.pop("prefix")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




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


        scim_token = cls(
            id=id,
            name=name,
            prefix=prefix,
            created_at=created_at,
            last_used_at=last_used_at,
        )

        return scim_token

