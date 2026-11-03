from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.security_grant_input_type_0 import SecurityGrantInputType0
  from ..models.security_grant_input_type_1 import SecurityGrantInputType1
  from ..models.security_grant_input_type_2 import SecurityGrantInputType2
  from ..models.security_grant_input_type_3 import SecurityGrantInputType3





T = TypeVar("T", bound="UpdateSecuritySchemeRequestLevelsItem")



@_attrs_define
class UpdateSecuritySchemeRequestLevelsItem:
    """ 
        Attributes:
            name (str):
            grants (list[SecurityGrantInputType0 | SecurityGrantInputType1 | SecurityGrantInputType2 |
                SecurityGrantInputType3]):
            id (UUID | Unset):
            description (str | Unset):  Default: ''.
     """

    name: str
    grants: list[SecurityGrantInputType0 | SecurityGrantInputType1 | SecurityGrantInputType2 | SecurityGrantInputType3]
    id: UUID | Unset = UNSET
    description: str | Unset = ''
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.security_grant_input_type_0 import SecurityGrantInputType0 # noqa: PLC0415
        from ..models.security_grant_input_type_1 import SecurityGrantInputType1 # noqa: PLC0415
        from ..models.security_grant_input_type_2 import SecurityGrantInputType2 # noqa: PLC0415
        from ..models.security_grant_input_type_3 import SecurityGrantInputType3 # noqa: PLC0415
        name = self.name

        grants = []
        for grants_item_data in self.grants:
            grants_item: dict[str, Any]
            if isinstance(grants_item_data, SecurityGrantInputType0):
                grants_item = grants_item_data.to_dict()
            elif isinstance(grants_item_data, SecurityGrantInputType1):
                grants_item = grants_item_data.to_dict()
            elif isinstance(grants_item_data, SecurityGrantInputType2):
                grants_item = grants_item_data.to_dict()
            else:
                grants_item = grants_item_data.to_dict()

            grants.append(grants_item)



        id: str | Unset = UNSET
        if not isinstance(self.id, Unset):
            id = str(self.id)

        description = self.description


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "grants": grants,
        })
        if id is not UNSET:
            field_dict["id"] = id
        if description is not UNSET:
            field_dict["description"] = description

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.security_grant_input_type_0 import SecurityGrantInputType0 # noqa: PLC0415
        from ..models.security_grant_input_type_1 import SecurityGrantInputType1 # noqa: PLC0415
        from ..models.security_grant_input_type_2 import SecurityGrantInputType2 # noqa: PLC0415
        from ..models.security_grant_input_type_3 import SecurityGrantInputType3 # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name")

        grants = []
        _grants = d.pop("grants")
        for grants_item_data in (_grants):
            def _parse_grants_item(data: object) -> SecurityGrantInputType0 | SecurityGrantInputType1 | SecurityGrantInputType2 | SecurityGrantInputType3:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_security_grant_input_type_0 = SecurityGrantInputType0.from_dict(data)



                    return componentsschemas_security_grant_input_type_0
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_security_grant_input_type_1 = SecurityGrantInputType1.from_dict(data)



                    return componentsschemas_security_grant_input_type_1
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_security_grant_input_type_2 = SecurityGrantInputType2.from_dict(data)



                    return componentsschemas_security_grant_input_type_2
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_security_grant_input_type_3 = SecurityGrantInputType3.from_dict(data)



                return componentsschemas_security_grant_input_type_3

            grants_item = _parse_grants_item(grants_item_data)

            grants.append(grants_item)


        _id = d.pop("id", UNSET)
        id: UUID | Unset
        if isinstance(_id,  Unset):
            id = UNSET
        else:
            id = UUID(_id)




        description = d.pop("description", UNSET)

        update_security_scheme_request_levels_item = cls(
            name=name,
            grants=grants,
            id=id,
            description=description,
        )


        update_security_scheme_request_levels_item.additional_properties = d
        return update_security_scheme_request_levels_item

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
