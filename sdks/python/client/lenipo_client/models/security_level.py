from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.security_grant import SecurityGrant





T = TypeVar("T", bound="SecurityLevel")



@_attrs_define
class SecurityLevel:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            grants (list[SecurityGrant]):
     """

    id: UUID
    name: str
    description: str
    grants: list[SecurityGrant]





    def to_dict(self) -> dict[str, Any]:
        from ..models.security_grant import SecurityGrant # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        grants = []
        for grants_item_data in self.grants:
            grants_item = grants_item_data.to_dict()
            grants.append(grants_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "grants": grants,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.security_grant import SecurityGrant # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        grants = []
        _grants = d.pop("grants")
        for grants_item_data in (_grants):
            grants_item = SecurityGrant.from_dict(grants_item_data)



            grants.append(grants_item)


        security_level = cls(
            id=id,
            name=name,
            description=description,
            grants=grants,
        )

        return security_level

