from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.permission_grant_input_type_0 import PermissionGrantInputType0
  from ..models.permission_grant_input_type_1 import PermissionGrantInputType1
  from ..models.permission_grant_input_type_2 import PermissionGrantInputType2
  from ..models.permission_grant_input_type_3 import PermissionGrantInputType3





T = TypeVar("T", bound="UpdatePermissionSchemeRequest")



@_attrs_define
class UpdatePermissionSchemeRequest:
    """ 
        Attributes:
            name (str | Unset):
            description (str | Unset):
            grants (list[PermissionGrantInputType0 | PermissionGrantInputType1 | PermissionGrantInputType2 |
                PermissionGrantInputType3] | Unset):
     """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    grants: list[PermissionGrantInputType0 | PermissionGrantInputType1 | PermissionGrantInputType2 | PermissionGrantInputType3] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.permission_grant_input_type_0 import PermissionGrantInputType0 # noqa: PLC0415
        from ..models.permission_grant_input_type_1 import PermissionGrantInputType1 # noqa: PLC0415
        from ..models.permission_grant_input_type_2 import PermissionGrantInputType2 # noqa: PLC0415
        from ..models.permission_grant_input_type_3 import PermissionGrantInputType3 # noqa: PLC0415
        name = self.name

        description = self.description

        grants: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.grants, Unset):
            grants = []
            for grants_item_data in self.grants:
                grants_item: dict[str, Any]
                if isinstance(grants_item_data, PermissionGrantInputType0):
                    grants_item = grants_item_data.to_dict()
                elif isinstance(grants_item_data, PermissionGrantInputType1):
                    grants_item = grants_item_data.to_dict()
                elif isinstance(grants_item_data, PermissionGrantInputType2):
                    grants_item = grants_item_data.to_dict()
                else:
                    grants_item = grants_item_data.to_dict()

                grants.append(grants_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if grants is not UNSET:
            field_dict["grants"] = grants

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.permission_grant_input_type_0 import PermissionGrantInputType0 # noqa: PLC0415
        from ..models.permission_grant_input_type_1 import PermissionGrantInputType1 # noqa: PLC0415
        from ..models.permission_grant_input_type_2 import PermissionGrantInputType2 # noqa: PLC0415
        from ..models.permission_grant_input_type_3 import PermissionGrantInputType3 # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        _grants = d.pop("grants", UNSET)
        grants: list[PermissionGrantInputType0 | PermissionGrantInputType1 | PermissionGrantInputType2 | PermissionGrantInputType3] | Unset = UNSET
        if _grants is not UNSET:
            grants = []
            for grants_item_data in _grants:
                def _parse_grants_item(data: object) -> PermissionGrantInputType0 | PermissionGrantInputType1 | PermissionGrantInputType2 | PermissionGrantInputType3:
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_permission_grant_input_type_0 = PermissionGrantInputType0.from_dict(data)



                        return componentsschemas_permission_grant_input_type_0
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_permission_grant_input_type_1 = PermissionGrantInputType1.from_dict(data)



                        return componentsschemas_permission_grant_input_type_1
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_permission_grant_input_type_2 = PermissionGrantInputType2.from_dict(data)



                        return componentsschemas_permission_grant_input_type_2
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_permission_grant_input_type_3 = PermissionGrantInputType3.from_dict(data)



                    return componentsschemas_permission_grant_input_type_3

                grants_item = _parse_grants_item(grants_item_data)

                grants.append(grants_item)


        update_permission_scheme_request = cls(
            name=name,
            description=description,
            grants=grants,
        )


        update_permission_scheme_request.additional_properties = d
        return update_permission_scheme_request

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
